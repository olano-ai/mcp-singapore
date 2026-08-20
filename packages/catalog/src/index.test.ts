import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  datasetSpecs,
  freshness,
  numericProfile,
  registerCatalogTools,
  rowsFrom,
} from './index.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('catalog helpers', () => {
  it('extracts datastore rows and rejects malformed rows', () => {
    expect(
      rowsFrom({ result: { records: [{ town: 'BEDOK' }, null, 'bad', { town: 'TAMPINES' }] } }),
    ).toEqual([{ town: 'BEDOK' }, { town: 'TAMPINES' }]);
    expect(rowsFrom({ result: { records: null } })).toEqual([]);
    expect(
      rowsFrom({
        type: 'FeatureCollection',
        features: [
          {
            properties: { locality: 'BEDOK', cases: 4 },
            geometry: { type: 'Point', coordinates: [103.9, 1.3] },
          },
        ],
      }),
    ).toEqual([
      {
        locality: 'BEDOK',
        cases: 4,
        geometry: { type: 'Point', coordinates: [103.9, 1.3] },
      },
    ]);
    expect(() => rowsFrom({ code: 7, errorMsg: 'not ready' })).toThrow('not ready');
  });

  it('profiles numeric fields without treating text as zero', () => {
    expect(
      numericProfile([
        { town: 'BEDOK', price: '500,000' },
        { town: 'TAMPINES', price: 700_000 },
      ]),
    ).toMatchObject({
      sample_size: 2,
      numeric: { price: { count: 2, min: 500_000, max: 700_000, mean: 600_000 } },
    });
  });

  it('classifies dated source coverage and returns unknown when dates are absent', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T00:00:00Z'));
    expect(freshness({ updatedAt: '2026-08-01' }, [])).toMatchObject({ level: 'fresh' });
    expect(freshness({ updatedAt: '2025-08-01' }, [])).toMatchObject({ level: 'frozen' });
    expect(freshness({}, [{ value: '2026' }, { lease_commence_date: '2026' }])).toEqual({
      latest_date: null,
      age_days: null,
      level: 'unknown',
    });
    expect(freshness({}, [{ period: '2026Jul' }])).toMatchObject({
      latest_date: '2026-07-01',
    });
    expect(freshness({}, [])).toEqual({ latest_date: null, age_days: null, level: 'unknown' });
    vi.useRealTimers();
  });

  it('keeps curated dataset identifiers unique', () => {
    expect(datasetSpecs).toHaveLength(24);
    expect(new Set(datasetSpecs.map(({ datasetId }) => datasetId)).size).toBe(datasetSpecs.length);
    expect(new Set(datasetSpecs.map(({ prefix }) => prefix)).size).toBe(datasetSpecs.length);
  });

  it('searches the registered dengue GeoJSON dataset through poll-download', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: { url: 'https://storage.googleapis.com/example/dengue.geojson' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            type: 'FeatureCollection',
            features: [
              {
                properties: { locality: 'BEDOK NORTH', cases: 8 },
                geometry: { type: 'Point', coordinates: [103.93, 1.33] },
              },
              {
                properties: { locality: 'JURONG WEST', cases: 3 },
                geometry: { type: 'Point', coordinates: [103.7, 1.34] },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/geo+json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchImpl);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({ name: 'catalog-test', version: '1.0.0' });
    registerCatalogTools(server);
    const client = new Client({ name: 'catalog-test-client', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const response = await client.callTool({
      name: 'dengue_clusters_search',
      arguments: { query: 'bedok', limit: 10, offset: 0 },
    });

    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({
      source_format: 'geojson',
      retrieval: 'data.gov.sg poll-download',
      result: {
        total: 1,
        records: [expect.objectContaining({ locality: 'BEDOK NORTH', cases: 8 })],
      },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    await client.close();
    await server.close();
  });
});
