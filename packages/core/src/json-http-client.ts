import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export interface JsonHttpClientOptions {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
  cacheTtlMs?: number;
  maxResponseBytes?: number;
  retries?: number;
  minRequestIntervalMs?: number;
  fetchImpl?: typeof fetch;
  /** Optional public-response disk cache. Also enabled by OLANO_SG_CACHE_DIR. */
  persistentCacheDir?: string;
  cacheNamespace?: string;
}

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

interface DiskCacheEntry extends CacheEntry {
  cachedAt: number;
  sourceUrl: string;
}

function redactedSourceUrl(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  // Search parameters can contain addresses, company names, coordinates, UENs,
  // and other user-provided data even when none of their keys look secret.
  url.search = '';
  return url.toString();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Reject common HTTP-200 application-error envelopes used by Singapore APIs. */
export function assertSuccessfulEnvelope(value: unknown, provider = 'Upstream API'): void {
  const root = record(value);
  const code =
    typeof root.code === 'number'
      ? root.code
      : typeof root.code === 'string' && /^\d+$/.test(root.code)
        ? Number(root.code)
        : undefined;
  const statusCode =
    typeof root.statusCode === 'number'
      ? root.statusCode
      : typeof root.StatusCode === 'number'
        ? root.StatusCode
        : undefined;
  const explicitError =
    (root.error !== undefined &&
      root.error !== null &&
      root.error !== false &&
      root.error !== '') ||
    (Array.isArray(root.errors) && root.errors.length > 0);
  const failed =
    root.success === false ||
    root.Success === false ||
    explicitError ||
    (code !== undefined && code !== 0 && code !== 200) ||
    (statusCode !== undefined && statusCode >= 400);
  if (!failed) return;

  const rawMessage =
    root.errorMsg ??
    root.errMsg ??
    root.error ??
    root.message ??
    root.Message ??
    'application error';
  const message =
    typeof rawMessage === 'string'
      ? rawMessage.slice(0, 500)
      : JSON.stringify(rawMessage).slice(0, 500);
  throw new ApiError(`${provider} returned an application error: ${message}`, statusCode);
}

/** Read a response body without allowing a chunked response to bypass the size limit. */
export async function readBoundedResponseText(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > maximumBytes) {
    throw new ApiError(`Upstream response exceeds ${maximumBytes} bytes.`);
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > maximumBytes) {
        await reader.cancel();
        throw new ApiError(`Upstream response exceeds ${maximumBytes} bytes.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    receivedBytes,
  ).toString('utf8');
}

export class JsonHttpClient {
  private readonly baseUrl: URL;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly maxResponseBytes: number;
  private readonly retries: number;
  private readonly minRequestIntervalMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly persistentCacheDir: string | undefined;
  private readonly cacheNamespace: string;
  private readonly cacheIdentity: string;
  private readonly cache = new Map<string, CacheEntry>();
  private requestGate: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;

  constructor(options: JsonHttpClientOptions) {
    this.baseUrl = new URL(options.baseUrl);
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.cacheTtlMs = options.cacheTtlMs ?? 30_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 5_000_000;
    this.retries = options.retries ?? 2;
    this.minRequestIntervalMs = options.minRequestIntervalMs ?? 50;
    this.fetchImpl = options.fetchImpl ?? fetch;
    const configuredCacheDir = options.persistentCacheDir ?? process.env.OLANO_SG_CACHE_DIR;
    this.persistentCacheDir = configuredCacheDir ? resolve(configuredCacheDir) : undefined;
    this.cacheNamespace = options.cacheNamespace ?? this.baseUrl.hostname;
    this.cacheIdentity = createHash('sha256')
      .update(
        JSON.stringify(
          Object.entries(this.defaultHeaders)
            .map(([key, value]) => [key.toLowerCase(), value] as const)
            .sort(([left], [right]) => left.localeCompare(right)),
        ),
      )
      .digest('hex');
  }

  async get(
    path: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<unknown> {
    const url = new URL(path.replace(/^\/+/, ''), this.baseUrl);
    if (url.origin !== this.baseUrl.origin) {
      throw new ApiError('Refusing a request outside the configured upstream API origin.');
    }
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    // Partition persistent entries by request identity without writing headers or
    // tokens to disk. This prevents authenticated clients sharing cached results.
    const cacheKey = `${url.toString()}\nidentity:${this.cacheIdentity}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const persisted = await this.readPersistentCache(cacheKey);
    if (persisted) {
      this.cache.set(cacheKey, persisted);
      return persisted.value;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const value = await this.request(url);
        const entry = { expiresAt: Date.now() + this.cacheTtlMs, value };
        this.cache.set(cacheKey, entry);
        await this.writePersistentCache(cacheKey, value, url.toString(), entry.expiresAt);
        return value;
      } catch (error) {
        lastError = error;
        const retryable =
          !(error instanceof ApiError) || error.status === 429 || (error.status ?? 0) >= 500;
        if (!retryable || attempt === this.retries) break;
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      }
    }
    throw lastError;
  }

  private cachePath(cacheKey: string): string | undefined {
    if (!this.persistentCacheDir) return undefined;
    const namespace = this.cacheNamespace.replaceAll(/[^A-Za-z0-9_-]/g, '_') || 'default';
    const digest = createHash('sha256').update(cacheKey).digest('hex');
    return join(this.persistentCacheDir, namespace, `${digest}.json`);
  }

  private async readPersistentCache(cacheKey: string): Promise<CacheEntry | undefined> {
    const path = this.cachePath(cacheKey);
    if (!path) return undefined;
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<DiskCacheEntry>;
      if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= Date.now()) return undefined;
      return { expiresAt: parsed.expiresAt, value: parsed.value };
    } catch {
      return undefined;
    }
  }

  private async writePersistentCache(
    cacheKey: string,
    value: unknown,
    sourceUrl: string,
    expiresAt: number,
  ): Promise<void> {
    const path = this.cachePath(cacheKey);
    if (!path) return;
    const directory = dirname(path);
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const entry: DiskCacheEntry = {
        cachedAt: Date.now(),
        expiresAt,
        sourceUrl: redactedSourceUrl(sourceUrl),
        value,
      };
      await writeFile(temporaryPath, JSON.stringify(entry), { encoding: 'utf8', mode: 0o600 });
      await rename(temporaryPath, path);
    } catch {
      // Cache failures must never make an upstream request fail.
    }
  }

  private async request(url: URL): Promise<unknown> {
    await this.waitForTurn();
    const response = await this.fetchImpl(url, {
      headers: { accept: 'application/json', ...this.defaultHeaders },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      let body = '[response body unavailable]';
      try {
        body = await readBoundedResponseText(response, 5_000);
      } catch {
        // Keep the generic fallback. This read fails on the size bound, but also on a mid-stream
        // network error, so naming one cause would sometimes report the wrong one.
      }
      throw new ApiError(`Upstream API returned HTTP ${response.status}: ${body}`, response.status);
    }

    const text = await readBoundedResponseText(response, this.maxResponseBytes);
    let value: unknown;
    try {
      value = JSON.parse(text) as unknown;
    } catch {
      throw new ApiError('Upstream API returned invalid JSON.');
    }
    assertSuccessfulEnvelope(value);
    return value;
  }

  private async waitForTurn(): Promise<void> {
    let release = (): void => undefined;
    const previous = this.requestGate;
    this.requestGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const waitMs = Math.max(0, this.nextRequestAt - Date.now());
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.nextRequestAt = Date.now() + this.minRequestIntervalMs;
    release();
  }
}
