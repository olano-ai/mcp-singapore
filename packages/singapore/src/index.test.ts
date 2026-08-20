import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createSingaporeServer,
  toolMatchesSingaporeProfile,
  type SingaporeToolProfile,
} from './index.js';

async function connect(profile: SingaporeToolProfile = 'all') {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createSingaporeServer({ profile });
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

afterEach(() => vi.unstubAllGlobals());

describe('aggregate Singapore MCP server', () => {
  it('exposes the complete namespaced tool suite', async () => {
    const { client, server } = await connect();
    const { tools } = await client.listTools();

    expect(tools.length).toBeGreaterThan(280);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'datagov_list_datasets',
        'onemap_search',
        'lta_bus_arrivals',
        'weather_two_hour_forecast',
        'hdb_resale_search',
        'acra_search_entities',
        'singstat_household_income_latest',
        'finance_mortgage_rates_latest',
        'finance_mortgage_payment',
        'analytics_correlate_series',
        'singapore_prompt_examples',
        'singapore_capability_registry',
        'insights_compare_series',
        'sg_hdb_resale_stats',
        'sg_fx_rate',
        'rail_search_stations',
        'rail_nearest_stations',
        'rail_list_lines',
        'singapore_location_brief',
        'singapore_company_brief',
        'singapore_property_area_brief',
        'singapore_market_context',
        'singapore_cache_info',
        'singapore_tool_profiles',
      ]),
    );

    await client.close();
    await server.close();
  });

  it.each([
    ['mobility', 'rail_list_lines', 'hdb_resale_search'],
    ['property', 'hdb_resale_search', 'lta_bus_arrivals'],
    ['business', 'acra_search_entities', 'weather_two_hour_forecast'],
    ['economy', 'gdp_growth_search', 'rail_list_lines'],
    ['civic', 'weather_two_hour_forecast', 'finance_mortgage_payment'],
    ['finance', 'finance_mortgage_payment', 'lta_bus_arrivals'],
  ] satisfies [SingaporeToolProfile, string, string][])(
    'filters the %s tool profile server-side',
    async (profile, included, excluded) => {
      const { client, server } = await connect(profile);
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name);

      expect(names).toContain(included);
      expect(names).not.toContain(excluded);
      expect(names).toContain('singapore_tool_profiles');
      expect(names.every((name) => toolMatchesSingaporeProfile(name, profile))).toBe(true);
      expect(tools.length).toBeLessThan(100);
      await expect(client.callTool({ name: excluded, arguments: {} })).rejects.toThrow(
        `Tool ${excluded} disabled`,
      );

      const discovery = await client.callTool({
        name: 'singapore_tool_profiles',
        arguments: { profile, includeTools: true },
      });
      expect(discovery.structuredContent).toMatchObject({
        active_profile: profile,
        selected_profile: profile,
        selected_tool_count: tools.length,
        tools: names.slice().sort(),
      });

      const { prompts } = await client.listPrompts();
      const { resources } = await client.listResources();
      expect(prompts).toHaveLength(5);
      expect(resources).toHaveLength(3);

      await client.close();
      await server.close();
    },
  );

  it('rejects an unknown profile with the complete supported-name list', () => {
    expect(() =>
      createSingaporeServer({ profile: 'not-a-profile' as SingaporeToolProfile }),
    ).toThrow('Choose one of: all, mobility, property, business, economy, civic, finance');
  });

  it('exposes source and query-example MCP resources', async () => {
    const { client, server } = await connect();
    const { resources } = await client.listResources();

    expect(resources.map((resource) => resource.uri)).toEqual(
      expect.arrayContaining(['singapore://about', 'singapore://sources', 'singapore://examples']),
    );
    const result = await client.readResource({ uri: 'singapore://sources' });
    expect(JSON.stringify(result.contents)).toContain('data.gov.sg');

    await client.close();
    await server.close();
  });

  it('exposes reusable MCP prompts for common Singapore workflows', async () => {
    const { client, server } = await connect();
    const { prompts } = await client.listPrompts();

    expect(prompts.map((prompt) => prompt.name)).toEqual(
      expect.arrayContaining([
        'research-singapore',
        'research-neighbourhood',
        'research-company',
        'analyze-property',
        'analyze-mobility',
      ]),
    );

    await client.close();
    await server.close();
  });

  it('runs deterministic finance and analytics tools without credentials', async () => {
    const { client, server } = await connect();
    const mortgage = await client.callTool({
      name: 'finance_mortgage_payment',
      arguments: { principal: 500_000, annualRate: 3, years: 25 },
    });
    const analytics = await client.callTool({
      name: 'analytics_correlate_series',
      arguments: { left: [1, 2, 3], right: [2, 4, 6] },
    });

    expect(mortgage.structuredContent).toMatchObject({ principal: 500_000 });
    expect(analytics.structuredContent).toMatchObject({ pearson_r: 1 });

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
