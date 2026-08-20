import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, assertSuccessfulEnvelope, JsonHttpClient } from './json-http-client.js';

describe('JsonHttpClient', () => {
  it('encodes query parameters and caches successful responses', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new JsonHttpClient({ baseUrl: 'https://example.test/api/', fetchImpl });

    await client.get('items', { q: 'Raffles Place', page: 2 });
    await client.get('items', { q: 'Raffles Place', page: 2 });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://example.test/api/items?q=Raffles+Place&page=2',
    );
  });

  it('reuses an optional persistent cache across client instances', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'olano-sg-cache-'));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ cached: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const options = {
      baseUrl: 'https://example.com/api/',
      cacheTtlMs: 60_000,
      persistentCacheDir: cacheDir,
      cacheNamespace: 'test',
      fetchImpl,
    };

    expect(await new JsonHttpClient(options).get('value', { apiKey: 'never-store-me' })).toEqual({
      cached: true,
    });
    expect(await new JsonHttpClient(options).get('value', { apiKey: 'never-store-me' })).toEqual({
      cached: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const namespaceFiles = await import('node:fs/promises').then(({ readdir }) =>
      readdir(join(cacheDir, 'test')),
    );
    const entry = JSON.parse(
      await readFile(join(cacheDir, 'test', namespaceFiles[0]!), 'utf8'),
    ) as { sourceUrl: string };
    expect(entry.sourceUrl).toBe('https://example.com/api/value');
    expect(await readFile(join(cacheDir, 'test', namespaceFiles[0]!), 'utf8')).not.toContain(
      'never-store-me',
    );
  });

  it('partitions persistent cache entries by hashed request identity', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'olano-sg-cache-identity-'));
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ tenant: 'one' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ tenant: 'two' })));
    const common = {
      baseUrl: 'https://example.com/api/',
      cacheTtlMs: 60_000,
      persistentCacheDir: cacheDir,
      cacheNamespace: 'identity-test',
      fetchImpl,
    };

    expect(
      await new JsonHttpClient({ ...common, defaultHeaders: { authorization: 'Bearer one' } }).get(
        'value',
      ),
    ).toEqual({ tenant: 'one' });
    expect(
      await new JsonHttpClient({ ...common, defaultHeaders: { authorization: 'Bearer two' } }).get(
        'value',
      ),
    ).toEqual({ tenant: 'two' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects HTTP-200 application error envelopes', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ code: 17, errorMsg: 'dataset unavailable' }), {
        status: 200,
      }),
    );
    const client = new JsonHttpClient({
      baseUrl: 'https://example.test/',
      fetchImpl,
      retries: 0,
    });

    await expect(client.get('data')).rejects.toThrow('dataset unavailable');
    expect(() =>
      assertSuccessfulEnvelope({ success: false, message: 'denied' }, 'Provider'),
    ).toThrow('Provider returned an application error: denied');
    expect(() => assertSuccessfulEnvelope({ code: 0, data: {} })).not.toThrow();
    expect(() => assertSuccessfulEnvelope({ error: 'invalid token' }, 'OneMap')).toThrow(
      'invalid token',
    );
  });

  it('rejects oversized responses', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ x: 'long' })));
    const client = new JsonHttpClient({
      baseUrl: 'https://example.test/',
      fetchImpl,
      maxResponseBytes: 5,
      retries: 0,
    });
    await expect(client.get('data')).rejects.toBeInstanceOf(ApiError);
  });
});
