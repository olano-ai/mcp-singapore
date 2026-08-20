import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRailServer,
  groupStationRecords,
  haversineDistanceMetres,
  lookupStation,
  nearestByCoordinate,
  parseExitFeatures,
  parseExitRows,
  parseStationCodeRows,
  publishedCodeConnections,
  stationsForLine,
} from './index.js';

async function connect() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createRailServer();
  const client = new Client({ name: 'rail-test-client', version: '1.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ONEMAP_TOKEN;
});

describe('rail source parsing', () => {
  it('parses LTA station-code tuples and maps branch lines', () => {
    const records = parseStationCodeRows([
      ['NS1', 'Jurong East', '裕廊东', 'North-South Line', '南北线'],
      ['CG1', 'Expo', '博览', 'Changi Airport Branch Line', '樟宜机场支线'],
    ]);

    expect(records).toMatchObject([
      { code: 'NS1', prefix: 'NS', officialLineCode: 'NSL' },
      { code: 'CG1', prefix: 'CG', officialLineCode: 'EWL' },
    ]);
  });

  it('parses data.gov.sg GeoJSON property variants and coordinate order', () => {
    const exits = parseExitFeatures({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [103.851959, 1.29027] },
          properties: { STATION_NA: 'CITY HALL MRT STATION', EXIT_CODE: 'Exit A' },
        },
      ],
    });

    expect(exits[0]).toMatchObject({
      stationKey: 'CITY HALL',
      system: 'MRT',
      exitCode: 'Exit A',
      latitude: 1.29027,
      longitude: 103.851959,
    });
  });
});

describe('rail station grouping', () => {
  it('combines codes, systems, lines, and exits into one station complex', () => {
    const codes = parseStationCodeRows([
      ['NS4', 'Choa Chu Kang', '蔡厝港', 'North-South Line', '南北线'],
      ['BP1', 'Choa Chu Kang', '蔡厝港', 'Bukit Panjang LRT', '武吉班让轻轨线'],
    ]);
    const exits = parseExitRows([
      ['CHOA CHU KANG MRT STATION', 'Exit A', 1.385, 103.744],
      ['CHOA CHU KANG LRT STATION', 'Exit B', 1.386, 103.745],
    ]);

    const station = groupStationRecords(codes, exits)[0];
    expect(station).toMatchObject({
      name: 'Choa Chu Kang',
      systems: ['LRT', 'MRT'],
      exitCount: 2,
      latitude: 1.3855,
      longitude: 103.7445,
    });
    expect(station?.officialLineCodes).toEqual(expect.arrayContaining(['NSL', 'BP']));
  });

  it('looks up an official station by code or exact name', () => {
    expect(lookupStation('NS1')?.name).toBe('Jurong East');
    expect(lookupStation('Jurong East')?.codes.map((code) => code.code)).toContain('EW24');
  });

  it('resolves official line codes and station-code prefixes', () => {
    const byLineCode = stationsForLine('NSL').map((station) => station.name);
    const byPrefix = stationsForLine('NS').map((station) => station.name);
    expect(byLineCode).toEqual(byPrefix);
    expect(byLineCode).toContain('Jurong East');
    expect(byLineCode).toContain('Marina South Pier');
  });

  it('derives published code neighbours without claiming live routing', () => {
    const station = lookupStation('NS1');
    expect(station).toBeDefined();
    expect(publishedCodeConnections(station!)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'NS1',
          previous_published_code: null,
          next_published_code: { code: 'NS2', station_name: 'Bukit Batok' },
        }),
      ]),
    );
  });
});

describe('rail nearest-location calculations', () => {
  it('calculates deterministic great-circle distance', () => {
    expect(haversineDistanceMetres(1.3, 103.8, 1.3, 103.8)).toBe(0);
    expect(haversineDistanceMetres(1.3, 103.8, 1.301, 103.8)).toBeCloseTo(111.2, 0);
  });

  it('sorts and limits nearest points within the requested radius', () => {
    const points = [
      { id: 'far', latitude: 1.31, longitude: 103.8 },
      { id: 'near', latitude: 1.3001, longitude: 103.8 },
      { id: 'middle', latitude: 1.301, longitude: 103.8 },
    ];

    const results = nearestByCoordinate(points, 1.3, 103.8, 500, 2);
    expect(results.map((result) => result.item.id)).toEqual(['near', 'middle']);
    expect(results[0]!.distanceMetres).toBeLessThan(results[1]!.distanceMetres);
  });
});

describe('rail MCP tools', () => {
  it('registers the complete rail tool suite', async () => {
    const { client, server } = await connect();
    const { tools } = await client.listTools();

    expect(tools).toHaveLength(15);
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'rail_search_stations',
        'rail_get_station_exits',
        'rail_get_station_connections',
        'rail_nearest_stations_to_address',
        'rail_list_interchanges',
        'rail_historical_station_counts',
      ]),
    );

    await client.close();
    await server.close();
  });

  it('geocodes an address through OneMap before finding stations', async () => {
    process.env.ONEMAP_TOKEN = 'test-token';
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                SEARCHVAL: 'CITY HALL',
                ADDRESS: '3 ST ANDREW ROAD SINGAPORE',
                POSTAL: '178958',
                LATITUDE: '1.2923',
                LONGITUDE: '103.8510',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    const { client, server } = await connect();
    const response = await client.callTool({
      name: 'rail_nearest_stations_to_address',
      arguments: {
        query: '3 St Andrew Road',
        radiusMetres: 5_000,
        limit: 3,
        system: 'MRT',
      },
    });

    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({
      found: true,
      geocoded_result: { postal: '178958' },
      distance_type: 'great_circle_to_mean_official_exit_location',
    });
    expect(response.structuredContent).toMatchObject({ source_context: expect.any(Array) });

    await client.close();
    await server.close();
  });
});
