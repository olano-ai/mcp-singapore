export interface JsonHttpClientOptions {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
  cacheTtlMs?: number;
  maxResponseBytes?: number;
  retries?: number;
  minRequestIntervalMs?: number;
  fetchImpl?: typeof fetch;
}

interface CacheEntry {
  expiresAt: number;
  value: unknown;
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

export class JsonHttpClient {
  private readonly baseUrl: URL;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly maxResponseBytes: number;
  private readonly retries: number;
  private readonly minRequestIntervalMs: number;
  private readonly fetchImpl: typeof fetch;
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

    const cacheKey = url.toString();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      try {
        const value = await this.request(url);
        this.cache.set(cacheKey, { expiresAt: Date.now() + this.cacheTtlMs, value });
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

  private async request(url: URL): Promise<unknown> {
    await this.waitForTurn();
    const response = await this.fetchImpl(url, {
      headers: { accept: 'application/json', ...this.defaultHeaders },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new ApiError(`Upstream API returned HTTP ${response.status}: ${body}`, response.status);
    }

    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > this.maxResponseBytes) {
      throw new ApiError(`Upstream response exceeds ${this.maxResponseBytes} bytes.`);
    }
    const text = await response.text();
    if (Buffer.byteLength(text) > this.maxResponseBytes) {
      throw new ApiError(`Upstream response exceeds ${this.maxResponseBytes} bytes.`);
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ApiError('Upstream API returned invalid JSON.');
    }
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
