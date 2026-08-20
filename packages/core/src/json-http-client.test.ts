import { describe, expect, it, vi } from 'vitest';
import { ApiError, JsonHttpClient } from './json-http-client.js';

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
