import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import process from 'node:process';
import { createSingaporeServer } from '../packages/singapore/dist/index.js';

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

const checks = [
  {
    name: 'weather_two_hour_forecast',
    arguments: {},
    assert: (value) => nonEmptyArray(value?.data?.items),
    expectation: 'data.items to contain a current forecast',
  },
  {
    name: 'finance_mortgage_rates_latest',
    arguments: { series: 'SORA' },
    assert: (value) =>
      nonEmptyArray(value?.series) &&
      value.series.some((series) => nonEmptyArray(series?.observations)),
    expectation: 'at least one SORA series with an observation',
  },
  {
    name: 'hdb_resale_stats',
    arguments: { town: 'BEDOK', flatType: '4 ROOM' },
    assert: (value) =>
      value?.filters?.town === 'BEDOK' &&
      value?.filters?.flat_type === '4 ROOM' &&
      value?.transaction_count > 0 &&
      nonEmptyArray(value?.transactions) &&
      typeof value?.quartiles_sgd?.q1 === 'number' &&
      typeof value?.quartiles_sgd?.median === 'number' &&
      typeof value?.quartiles_sgd?.q3 === 'number' &&
      value?.period_selection?.complete_within_source_matches === true,
    expectation:
      'latest-month Bedok 4-room rows, quartiles, and a complete MCP-bounded period selection',
  },
  {
    name: 'singstat_business_formations_monthly_latest',
    arguments: {},
    assert: (value) => nonEmptyArray(value?.rows),
    expectation: 'rows to contain a SingStat series',
  },
  {
    name: 'rail_search_stations',
    arguments: { query: 'Paya Lebar', limit: 5, offset: 0 },
    assert: (value) => nonEmptyArray(value?.results),
    expectation: 'results to contain the bundled Paya Lebar station',
  },
];

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const server = createSingaporeServer();
const client = new Client({ name: 'olano-live-smoke', version: '0.3.0' });
await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

try {
  for (const check of checks) {
    const result = await client.callTool(check);
    if (result.isError) {
      throw new Error(`${check.name} failed: ${JSON.stringify(result.content)}`);
    }
    if (!result.structuredContent) {
      throw new Error(`${check.name} did not return structuredContent.`);
    }
    if (!check.assert(result.structuredContent)) {
      throw new Error(`${check.name} expected ${check.expectation}.`);
    }
    process.stdout.write(`PASS ${check.name}\n`);
  }
} finally {
  await client.close();
  await server.close();
}
