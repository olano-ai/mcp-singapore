import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSingaporeServer } from './index.js';

async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createSingaporeServer();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

afterEach(() => vi.unstubAllGlobals());

describe('aggregate Singapore MCP server', () => {
  it('exposes the complete namespaced tool suite', async () => {
    const { client, server } = await connect();
    const { tools } = await client.listTools();

    expect(tools).toHaveLength(20);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'datagov_list_datasets',
        'onemap_search',
        'lta_bus_arrivals',
        'weather_two_hour_forecast',
        'singapore_location_brief',
      ]),
    );

    await client.close();
    await server.close();
  });

  it('calls a public upstream through an MCP tool', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ code: 0, data: { forecast: 'Cloudy' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const { client, server } = await connect();
    const result = await client.callTool({ name: 'weather_two_hour_forecast', arguments: {} });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ code: 0 });

    await client.close();
    await server.close();
  });

  it('returns a clear configuration error for credentialed tools', async () => {
    delete process.env.ONEMAP_TOKEN;
    delete process.env.LTA_DATAMALL_API_KEY;
    const { client, server } = await connect();
    const oneMapResult = await client.callTool({
      name: 'onemap_search',
      arguments: { query: 'Raffles Place', page: 1, includeGeometry: false },
    });
    const ltaResult = await client.callTool({
      name: 'lta_traffic_incidents',
      arguments: {},
    });
    expect(oneMapResult.isError).toBe(true);
    expect(JSON.stringify(oneMapResult.content)).toContain('ONEMAP_TOKEN');
    expect(ltaResult.isError).toBe(true);
    expect(JSON.stringify(ltaResult.content)).toContain('LTA_DATAMALL_API_KEY');

    await client.close();
    await server.close();
  });
});
