import { McpServer } from '@modelcontextprotocol/server';
import {
  JsonHttpClient,
  errorResult,
  getOptionalEnv,
  jsonResult,
  packageVersion,
} from '@olano/mcp-core';
import * as z from 'zod/v4';
import { EXIT_ROWS, HISTORICAL_STATION_COUNTS, LTA_LINE_ROWS, STATION_CODE_ROWS } from './data.js';

export type RailSystem = 'MRT' | 'LRT';

export interface StationCodeRecord {
  code: string;
  prefix: string;
  stationName: string;
  stationNameChinese: string;
  lineName: string;
  lineNameChinese: string;
  officialLineCode: string;
}

export interface ExitPoint {
  stationName: string;
  stationKey: string;
  system: RailSystem;
  exitCode: string;
  latitude: number;
  longitude: number;
}

export interface RailStation {
  name: string;
  chineseNames: string[];
  systems: RailSystem[];
  codes: StationCodeRecord[];
  lineNames: string[];
  officialLineCodes: string[];
  latitude: number;
  longitude: number;
  coordinateMethod: 'mean_of_official_exit_points';
  exitCount: number;
  codeSnapshotStatus: 'listed_in_january_2025' | 'not_listed_in_january_2025';
}

export interface DistanceResult<T> {
  item: T;
  distanceMetres: number;
}

const SOURCE_DATES = {
  stationCodes: '2025-01',
  stationExits: '2025-08',
  stationExitsPublisherUpdated: '2026-07',
  lineCodes: '2024-02',
  historicalCounts: '2004-2017',
} as const;

export const SOURCE_METADATA = [
  {
    id: 'lta_train_station_codes',
    title: 'Train Station Codes and Chinese Names',
    publisher: 'Land Transport Authority',
    coverage: SOURCE_DATES.stationCodes,
    retrievedAt: '2026-08-20',
    frequency: 'Ad-Hoc',
    officialUrl:
      'https://datamall.lta.gov.sg/content/dam/datamall/datasets/Geospatial/Train%20Station%20Codes%20and%20Chinese%20Names.zip',
    catalogueUrl: 'https://datamall.lta.gov.sg/content/datamall/en/static-data.html',
    usedFor: ['station codes', 'English and Chinese station names', 'line membership'],
    limitation:
      'This is a January 2025 snapshot. A listed code is not a live service-status signal.',
  },
  {
    id: 'lta_train_station_exits',
    title: 'Train Station Exit Point',
    publisher: 'Land Transport Authority',
    coverage: SOURCE_DATES.stationExits,
    publisherUpdatedAt: SOURCE_DATES.stationExitsPublisherUpdated,
    retrievedAt: '2026-08-20',
    frequency: 'Ad-Hoc',
    officialUrl:
      'https://datamall.lta.gov.sg/content/dam/datamall/datasets/Geospatial/TrainStationExit.zip',
    catalogueUrl: 'https://datamall.lta.gov.sg/content/datamall/en/static-data.html',
    dataGovSgMirror: 'https://data.gov.sg/datasets/d_b39d3a0871985372d7e1637193335da5/view',
    usedFor: ['station-exit locations', 'nearest-station calculations', 'station coordinates'],
    limitation:
      'The data.gov.sg mirror describes this as data from August 2025; July 2026 is the publisher-page update, not asserted observation coverage. Station coordinates are derived by averaging official exit points. They are not platform centroids, walking routes, accessibility claims, or live service status.',
  },
  {
    id: 'lta_train_line_codes',
    title: 'Train Lines Codes',
    publisher: 'Land Transport Authority',
    coverage: SOURCE_DATES.lineCodes,
    retrievedAt: '2026-08-20',
    frequency: 'Ad-Hoc',
    officialUrl:
      'https://datamall.lta.gov.sg/content/dam/datamall/datasets/PublicTransportRelated/Train%20Line%20Codes.xlsx',
    catalogueUrl: 'https://datamall.lta.gov.sg/content/datamall/en/static-data.html',
    usedFor: ['official line-code descriptions', 'directions recorded in the source snapshot'],
    limitation:
      'Direction and terminus text is from February 2024 and may predate later extensions. Do not use it as live journey-planning data.',
  },
  {
    id: 'datagov_historical_station_counts',
    title: 'Number of MRT and LRT Stations',
    publisher: 'Land Transport Authority via data.gov.sg',
    coverage: SOURCE_DATES.historicalCounts,
    retrievedAt: '2026-08-20',
    officialUrl: 'https://data.gov.sg/datasets/d_34dc2eb007a14ef406474abfb43c8671/view',
    apiUrl:
      'https://data.gov.sg/api/action/datastore_search?resource_id=d_34dc2eb007a14ef406474abfb43c8671',
    usedFor: ['historical MRT and LRT station counts'],
    limitation:
      'The published series ends in 2017 and contains no records for 2015 or 2016. It is historical, not a current network count.',
  },
  {
    id: 'sla_onemap_search',
    title: 'OneMap Search API',
    publisher: 'Singapore Land Authority',
    coverage: 'live request when invoked',
    retrievedAt: 'response time',
    officialUrl: 'https://www.onemap.gov.sg/apidocs/apidocs/#search',
    apiUrl: 'https://www.onemap.gov.sg/api/common/elastic/search',
    usedFor: ['optional address-to-coordinate lookup before nearest-station calculation'],
    limitation:
      'Requires ONEMAP_TOKEN. Search results are geocoding matches, while rail distance remains straight-line distance to mean exit positions.',
  },
] as const;

type SourceId = (typeof SOURCE_METADATA)[number]['id'];

function responseSourceContext(...sourceIds: SourceId[]): Record<string, unknown> {
  return {
    source_context: SOURCE_METADATA.filter((source) => sourceIds.includes(source.id)).map(
      (source) => ({
        id: source.id,
        title: source.title,
        publisher: source.publisher,
        coverage: source.coverage,
        publisher_updated_at:
          'publisherUpdatedAt' in source ? source.publisherUpdatedAt : undefined,
        retrieved_at: source.retrievedAt,
        official_url: source.officialUrl,
        freshness_caveat: source.limitation,
      }),
    ),
  };
}

const LINE_PREFIXES: Readonly<Record<string, readonly string[]>> = {
  CCL: ['CC', 'CE'],
  DTL: ['DT'],
  EWL: ['EW', 'CG'],
  NEL: ['NE'],
  NSL: ['NS'],
  PG: ['PE', 'PW'],
  SK: ['SE', 'SW'],
  BP: ['BP'],
  TEL: ['TE'],
};

const LINE_CODE_BY_NAME: Readonly<Record<string, string>> = {
  'BUKIT PANJANG LRT': 'BP',
  'CHANGI AIRPORT BRANCH LINE': 'EWL',
  'CIRCLE LINE': 'CCL',
  'CIRCLE LINE EXTENSION': 'CCL',
  'DOWNTOWN LINE': 'DTL',
  'EAST-WEST LINE': 'EWL',
  'NORTH EAST LINE': 'NEL',
  'NORTH-SOUTH LINE': 'NSL',
  'PUNGGOL LRT': 'PG',
  'SENGKANG LRT': 'SK',
  'THOMSON-EAST COAST LINE': 'TEL',
};

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function compareCodes(left: string, right: string): number {
  return left.localeCompare(right, 'en', { numeric: true });
}

function titleCaseStationName(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (letter) => letter.toUpperCase())
    .replace('One-North', 'one-north');
}

export function normalizeStationName(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+(?:MRT|LRT)\s+STATION$/, '')
    .replace(/\s+/g, ' ');
}

function stationPrefix(code: string): string {
  return code.toUpperCase().match(/^[A-Z]+/)?.[0] ?? '';
}

function lineCodeFor(lineName: string, prefix: string): string {
  const byName = LINE_CODE_BY_NAME[lineName.toUpperCase()];
  if (byName) return byName;
  const match = Object.entries(LINE_PREFIXES).find(([, prefixes]) => prefixes.includes(prefix));
  return match?.[0] ?? prefix;
}

function parseString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value.trim();
}

export function parseStationCodeRows(rows: readonly unknown[]): StationCodeRecord[] {
  return rows.map((row, index) => {
    if (!Array.isArray(row) || row.length < 5) {
      throw new TypeError(`Station-code row ${index} is not a five-column tuple`);
    }
    const code = parseString(row[0], `Station-code row ${index} code`).toUpperCase();
    const prefix = stationPrefix(code);
    const lineName = parseString(row[3], `Station-code row ${index} line name`);
    return {
      code,
      prefix,
      stationName: parseString(row[1], `Station-code row ${index} station name`),
      stationNameChinese: parseString(row[2], `Station-code row ${index} Chinese name`),
      lineName,
      lineNameChinese: parseString(row[4], `Station-code row ${index} Chinese line name`),
      officialLineCode: lineCodeFor(lineName, prefix),
    };
  });
}

export function parseExitRows(rows: readonly unknown[]): ExitPoint[] {
  return rows.map((row, index) => {
    if (!Array.isArray(row) || row.length < 4) {
      throw new TypeError(`Exit row ${index} is not a four-column tuple`);
    }
    const rawStationName = parseString(row[0], `Exit row ${index} station name`);
    const latitude = Number(row[2]);
    const longitude = Number(row[3]);
    if (
      !Number.isFinite(latitude) ||
      latitude < 1.1 ||
      latitude > 1.6 ||
      !Number.isFinite(longitude) ||
      longitude < 103.5 ||
      longitude > 104.1
    ) {
      throw new RangeError(`Exit row ${index} has coordinates outside Singapore bounds`);
    }
    return {
      stationName: rawStationName,
      stationKey: normalizeStationName(rawStationName),
      system: /\bLRT\b/i.test(rawStationName) ? 'LRT' : 'MRT',
      exitCode: parseString(row[1], `Exit row ${index} exit code`),
      latitude,
      longitude,
    };
  });
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function parseExitFeatures(value: unknown): ExitPoint[] {
  const root = record(value);
  if (!root || !Array.isArray(root.features)) {
    throw new TypeError('Expected a GeoJSON FeatureCollection with a features array');
  }
  const tuples = root.features.map((feature, index) => {
    const featureRecord = record(feature);
    const properties = record(featureRecord?.properties);
    const geometry = record(featureRecord?.geometry);
    const coordinates = geometry?.coordinates;
    if (!properties || !Array.isArray(coordinates) || coordinates.length < 2) {
      throw new TypeError(`GeoJSON feature ${index} is missing point geometry or properties`);
    }
    return [
      properties.STATION_NA ?? properties.stn_name,
      properties.EXIT_CODE ?? properties.exit_code,
      coordinates[1],
      coordinates[0],
    ];
  });
  return parseExitRows(tuples);
}

export function groupStationRecords(
  codes: readonly StationCodeRecord[],
  exits: readonly ExitPoint[],
): RailStation[] {
  const codesByStation = new Map<string, StationCodeRecord[]>();
  for (const code of codes) {
    const key = normalizeStationName(code.stationName);
    const values = codesByStation.get(key) ?? [];
    values.push(code);
    codesByStation.set(key, values);
  }

  const exitsByStation = new Map<string, ExitPoint[]>();
  for (const exit of exits) {
    const values = exitsByStation.get(exit.stationKey) ?? [];
    values.push(exit);
    exitsByStation.set(exit.stationKey, values);
  }

  const stationKeys = unique([...codesByStation.keys(), ...exitsByStation.keys()]);
  return stationKeys
    .map((key): RailStation | undefined => {
      const stationCodes = [...(codesByStation.get(key) ?? [])].sort((left, right) =>
        compareCodes(left.code, right.code),
      );
      const stationExits = exitsByStation.get(key) ?? [];
      if (stationExits.length === 0) return undefined;
      const latitude =
        stationExits.reduce((sum, exit) => sum + exit.latitude, 0) / stationExits.length;
      const longitude =
        stationExits.reduce((sum, exit) => sum + exit.longitude, 0) / stationExits.length;
      return {
        name: stationCodes[0]?.stationName ?? titleCaseStationName(key),
        chineseNames: unique(stationCodes.map((code) => code.stationNameChinese)),
        systems: unique(stationExits.map((exit) => exit.system)).sort(),
        codes: stationCodes,
        lineNames: unique(stationCodes.map((code) => code.lineName)),
        officialLineCodes: unique(stationCodes.map((code) => code.officialLineCode)),
        latitude,
        longitude,
        coordinateMethod: 'mean_of_official_exit_points',
        exitCount: stationExits.length,
        codeSnapshotStatus:
          stationCodes.length > 0 ? 'listed_in_january_2025' : 'not_listed_in_january_2025',
      };
    })
    .filter((station): station is RailStation => station !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));
}

export function haversineDistanceMetres(
  latitude: number,
  longitude: number,
  targetLatitude: number,
  targetLongitude: number,
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = radians(targetLatitude - latitude);
  const deltaLongitude = radians(targetLongitude - longitude);
  const originLatitude = radians(latitude);
  const destinationLatitude = radians(targetLatitude);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return 6_371_008.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearestByCoordinate<T extends { latitude: number; longitude: number }>(
  items: readonly T[],
  latitude: number,
  longitude: number,
  radiusMetres: number,
  limit: number,
): DistanceResult<T>[] {
  return items
    .map((item) => ({
      item,
      distanceMetres: haversineDistanceMetres(latitude, longitude, item.latitude, item.longitude),
    }))
    .filter((result) => result.distanceMetres <= radiusMetres)
    .sort((left, right) => left.distanceMetres - right.distanceMetres)
    .slice(0, limit);
}

const STATION_CODES = parseStationCodeRows(STATION_CODE_ROWS);
const EXIT_POINTS = parseExitRows(EXIT_ROWS);
const STATIONS = groupStationRecords(STATION_CODES, EXIT_POINTS);
const STATION_BY_KEY = new Map(
  STATIONS.map((station) => [normalizeStationName(station.name), station]),
);
const STATION_BY_CODE = new Map(
  STATIONS.flatMap((station) => station.codes.map((code) => [code.code, station] as const)),
);
const CODES_BY_PREFIX = new Map<string, StationCodeRecord[]>();
for (const code of STATION_CODES) {
  const values = CODES_BY_PREFIX.get(code.prefix) ?? [];
  values.push(code);
  CODES_BY_PREFIX.set(code.prefix, values);
}
for (const values of CODES_BY_PREFIX.values()) {
  values.sort((left, right) => compareCodes(left.code, right.code));
}

function resolveStation(identifier: string): RailStation | undefined {
  const normalized = identifier.trim().toUpperCase();
  return STATION_BY_CODE.get(normalized) ?? STATION_BY_KEY.get(normalizeStationName(identifier));
}

export function stationMatchesLine(station: RailStation, query: string): boolean {
  const normalized = query.trim().toUpperCase();
  const prefixes = LINE_PREFIXES[normalized] ?? [normalized];
  return (
    station.codes.some((code) => prefixes.includes(code.prefix)) ||
    station.officialLineCodes.includes(normalized) ||
    station.lineNames.some((name) => name.toUpperCase() === normalized)
  );
}

export function lookupStation(identifier: string): RailStation | undefined {
  return resolveStation(identifier);
}

export function stationsForLine(query: string): RailStation[] {
  return STATIONS.filter((station) => stationMatchesLine(station, query));
}

export function publishedCodeConnections(station: RailStation): Record<string, unknown>[] {
  return station.codes.map((code) => {
    const sequence = CODES_BY_PREFIX.get(code.prefix) ?? [];
    const index = sequence.findIndex((candidate) => candidate.code === code.code);
    const previous = index > 0 ? sequence[index - 1] : undefined;
    const next = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : undefined;
    return {
      code: code.code,
      prefix: code.prefix,
      line_name: code.lineName,
      official_line_code: code.officialLineCode,
      previous_published_code: previous
        ? { code: previous.code, station_name: previous.stationName }
        : null,
      next_published_code: next ? { code: next.code, station_name: next.stationName } : null,
    };
  });
}

function stationSearchRank(station: RailStation, query: string): number | undefined {
  const normalized = query.trim().toUpperCase();
  const name = normalizeStationName(station.name);
  const chinese = station.chineseNames.join(' ');
  if (station.codes.some((code) => code.code === normalized)) return 0;
  if (name === normalized) return 1;
  if (station.codes.some((code) => code.code.startsWith(normalized))) return 2;
  if (name.startsWith(normalized)) return 3;
  if (station.lineNames.some((line) => line.toUpperCase() === normalized)) return 4;
  if (name.includes(normalized) || chinese.includes(query.trim())) return 5;
  if (station.lineNames.some((line) => line.toUpperCase().includes(normalized))) return 6;
  return undefined;
}

function stationSummary(station: RailStation): Record<string, unknown> {
  return {
    name: station.name,
    chinese_names: station.chineseNames,
    systems: station.systems,
    codes: station.codes.map((code) => code.code),
    lines: station.lineNames,
    official_line_codes: station.officialLineCodes,
    latitude: station.latitude,
    longitude: station.longitude,
    coordinate_method: station.coordinateMethod,
    exit_count: station.exitCount,
    code_snapshot_status: station.codeSnapshotStatus,
  };
}

function stationDetail(station: RailStation): Record<string, unknown> {
  return {
    ...stationSummary(station),
    code_details: station.codes.map((code) => ({
      code: code.code,
      prefix: code.prefix,
      line_name: code.lineName,
      line_name_chinese: code.lineNameChinese,
      official_line_code: code.officialLineCode,
    })),
    source_coverage: {
      station_codes: SOURCE_DATES.stationCodes,
      station_exits: SOURCE_DATES.stationExits,
      station_exits_publisher_updated: SOURCE_DATES.stationExitsPublisherUpdated,
    },
    limitation:
      'Coordinates are the mean of official exit points. This package does not provide live service status or walking-route distance.',
  };
}

function paginated<T>(items: readonly T[], offset: number, limit: number): Record<string, unknown> {
  return { total: items.length, offset, limit, results: items.slice(offset, offset + limit) };
}

const singaporeLatitude = z.number().finite().min(1.1).max(1.6);
const singaporeLongitude = z.number().finite().min(103.5).max(104.1);
const stationIdentifier = z.string().trim().min(1).max(100);
const paginationSchema = {
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(250).default(100),
};

export function registerRailTools(server: McpServer): void {
  let oneMapApi: JsonHttpClient | undefined;

  server.registerTool(
    'rail_source_metadata',
    {
      title: 'Describe Singapore rail data sources',
      description:
        'Return authoritative source URLs, coverage dates, derivation details, and limitations for this rail package.',
      inputSchema: z.object({}),
    },
    async () =>
      jsonResult({
        sources: SOURCE_METADATA,
        generated_on: '2026-08-20',
        licence: 'Singapore Open Data Licence where stated by the publishing portal',
        licence_url: 'https://data.gov.sg/open-data-licence',
        package_policy:
          'Snapshot dates are kept separate. No tool presents these files as a live operational-status feed.',
        ...responseSourceContext(
          'lta_train_station_codes',
          'lta_train_station_exits',
          'lta_train_line_codes',
          'datagov_historical_station_counts',
          'sla_onemap_search',
        ),
      }),
  );

  server.registerTool(
    'rail_network_summary',
    {
      title: 'Summarize the Singapore rail network snapshot',
      description:
        'Summarize named station locations, exits, systems, line membership, and source coverage in the bundled official snapshots.',
      inputSchema: z.object({}),
    },
    async () =>
      jsonResult({
        named_station_locations: STATIONS.length,
        station_code_records: STATION_CODES.length,
        official_exit_points: EXIT_POINTS.length,
        listed_station_locations: STATIONS.filter(
          (station) => station.codeSnapshotStatus === 'listed_in_january_2025',
        ).length,
        exit_locations_not_listed_in_code_snapshot: STATIONS.filter(
          (station) => station.codeSnapshotStatus === 'not_listed_in_january_2025',
        ).map((station) => station.name),
        mrt_locations: STATIONS.filter((station) => station.systems.includes('MRT')).length,
        lrt_locations: STATIONS.filter((station) => station.systems.includes('LRT')).length,
        interchange_locations: STATIONS.filter((station) => station.officialLineCodes.length > 1)
          .length,
        source_coverage: SOURCE_DATES,
        caveat:
          'Counts describe combined snapshots, not a live count of stations currently in passenger service.',
        ...responseSourceContext('lta_train_station_codes', 'lta_train_station_exits'),
      }),
  );

  server.registerTool(
    'rail_list_stations',
    {
      title: 'List Singapore MRT and LRT stations',
      description:
        'List station locations with official codes, lines, Chinese names, exit-derived coordinates, and snapshot status.',
      inputSchema: z.object({
        system: z.enum(['all', 'MRT', 'LRT']).default('all'),
        line: z.string().trim().min(1).max(80).optional(),
        codeSnapshotStatus: z
          .enum(['all', 'listed_in_january_2025', 'not_listed_in_january_2025'])
          .default('all'),
        ...paginationSchema,
      }),
    },
    async ({ system, line, codeSnapshotStatus, offset, limit }) => {
      const stations = STATIONS.filter(
        (station) =>
          (system === 'all' || station.systems.includes(system)) &&
          (!line || stationMatchesLine(station, line)) &&
          (codeSnapshotStatus === 'all' || station.codeSnapshotStatus === codeSnapshotStatus),
      ).map(stationSummary);
      return jsonResult({
        ...paginated(stations, offset, limit),
        source_coverage: SOURCE_DATES,
        ...responseSourceContext('lta_train_station_codes', 'lta_train_station_exits'),
      });
    },
  );

  server.registerTool(
    'rail_search_stations',
    {
      title: 'Search Singapore MRT and LRT stations',
      description:
        'Search by station name, station code, Chinese name, or line name, with exact matches ranked first.',
      inputSchema: z.object({
        query: z.string().trim().min(1).max(100),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    },
    async ({ query, limit }) => {
      const matches = STATIONS.map((station) => ({
        station,
        rank: stationSearchRank(station, query),
      }))
        .filter(
          (match): match is { station: RailStation; rank: number } => match.rank !== undefined,
        )
        .sort(
          (left, right) =>
            left.rank - right.rank || left.station.name.localeCompare(right.station.name, 'en'),
        )
        .slice(0, limit)
        .map(({ station, rank }) => ({ rank, ...stationSummary(station) }));
      return jsonResult({
        query,
        total_returned: matches.length,
        results: matches,
        ...responseSourceContext('lta_train_station_codes', 'lta_train_station_exits'),
      });
    },
  );

  server.registerTool(
    'rail_get_station',
    {
      title: 'Get a Singapore rail station',
      description:
        'Get one station complex by exact English station name or station code, including every line and code at an interchange.',
      inputSchema: z.object({ identifier: stationIdentifier }),
    },
    async ({ identifier }) => {
      const station = resolveStation(identifier);
      return jsonResult(
        station
          ? {
              found: true,
              station: stationDetail(station),
              ...responseSourceContext('lta_train_station_codes', 'lta_train_station_exits'),
            }
          : {
              found: false,
              identifier,
              hint: 'Use rail_search_stations for partial names.',
              ...responseSourceContext('lta_train_station_codes', 'lta_train_station_exits'),
            },
      );
    },
  );

  server.registerTool(
    'rail_list_exits',
    {
      title: 'List Singapore MRT and LRT station exits',
      description:
        'List official station-exit points, optionally filtered by station name/code and exit label.',
      inputSchema: z.object({
        stationQuery: z.string().trim().min(1).max(100).optional(),
        exitCode: z.string().trim().min(1).max(30).optional(),
        ...paginationSchema,
      }),
    },
    async ({ stationQuery, exitCode, offset, limit }) => {
      const stationQueryNormalized = stationQuery?.trim().toUpperCase();
      const matchingStationKeys = stationQuery
        ? new Set(
            STATIONS.filter(
              (station) => stationSearchRank(station, stationQuery) !== undefined,
            ).map((station) => normalizeStationName(station.name)),
          )
        : undefined;
      const exits = EXIT_POINTS.filter(
        (exit) =>
          (!stationQueryNormalized || matchingStationKeys?.has(exit.stationKey)) &&
          (!exitCode || exit.exitCode.toUpperCase().includes(exitCode.trim().toUpperCase())),
      ).map((exit) => {
        const station = STATION_BY_KEY.get(exit.stationKey);
        return {
          station_name: station?.name ?? titleCaseStationName(exit.stationKey),
          station_codes: station?.codes.map((code) => code.code) ?? [],
          system: exit.system,
          exit_code: exit.exitCode,
          latitude: exit.latitude,
          longitude: exit.longitude,
        };
      });
      return jsonResult({
        ...paginated(exits, offset, limit),
        source_coverage: SOURCE_DATES.stationExits,
        ...responseSourceContext('lta_train_station_exits', 'lta_train_station_codes'),
      });
    },
  );

  server.registerTool(
    'rail_get_station_connections',
    {
      title: 'Get published rail-code connections for a station',
      description:
        'Show line membership, interchange status, and previous/next published station codes for an exact station name or code. This is snapshot topology, not live routing.',
      inputSchema: z.object({ identifier: stationIdentifier }),
    },
    async ({ identifier }) => {
      const station = resolveStation(identifier);
      if (!station) {
        return jsonResult({
          found: false,
          identifier,
          hint: 'Use rail_search_stations for partial names.',
          ...responseSourceContext('lta_train_station_codes', 'lta_train_station_exits'),
        });
      }
      return jsonResult({
        found: true,
        station: stationSummary(station),
        is_interchange: station.officialLineCodes.length > 1,
        published_code_connections: publishedCodeConnections(station),
        topology_definition:
          'Previous and next records after sorting each station-code prefix numerically in the January 2025 LTA snapshot.',
        caveat:
          'Reserved code gaps, loops, branches, closures, transfer paths, and live service are not resolved. Do not treat these records as journey-planning instructions.',
        ...responseSourceContext('lta_train_station_codes', 'lta_train_station_exits'),
      });
    },
  );

  server.registerTool(
    'rail_get_station_exits',
    {
      title: 'Get all exits for a Singapore rail station',
      description:
        'Resolve an exact station name or code and return every official exit point for that station complex.',
      inputSchema: z.object({ identifier: stationIdentifier }),
    },
    async ({ identifier }) => {
      const station = resolveStation(identifier);
      if (!station) {
        return jsonResult({
          found: false,
          identifier,
          hint: 'Use rail_search_stations for partial names.',
          ...responseSourceContext('lta_train_station_codes', 'lta_train_station_exits'),
        });
      }
      const stationKey = normalizeStationName(station.name);
      const exits = EXIT_POINTS.filter((exit) => exit.stationKey === stationKey).map((exit) => ({
        exit_code: exit.exitCode,
        system: exit.system,
        latitude: exit.latitude,
        longitude: exit.longitude,
      }));
      return jsonResult({
        found: true,
        station: stationSummary(station),
        total_exits: exits.length,
        exits,
        source_coverage: SOURCE_DATES.stationExits,
        ...responseSourceContext('lta_train_station_codes', 'lta_train_station_exits'),
      });
    },
  );

  server.registerTool(
    'rail_nearest_stations',
    {
      title: 'Find nearest Singapore rail stations',
      description:
        'Find station complexes by straight-line distance to their mean official exit location. This is not walking-route distance.',
      inputSchema: z.object({
        latitude: singaporeLatitude,
        longitude: singaporeLongitude,
        radiusMetres: z.number().finite().min(50).max(50_000).default(5_000),
        limit: z.number().int().min(1).max(25).default(5),
        system: z.enum(['all', 'MRT', 'LRT']).default('all'),
      }),
    },
    async ({ latitude, longitude, radiusMetres, limit, system }) => {
      const candidates =
        system === 'all'
          ? STATIONS
          : STATIONS.filter((station) => station.systems.includes(system));
      const results = nearestByCoordinate(candidates, latitude, longitude, radiusMetres, limit).map(
        ({ item, distanceMetres }) => ({
          distance_metres: Math.round(distanceMetres),
          ...stationSummary(item),
        }),
      );
      return jsonResult({
        origin: { latitude, longitude },
        radius_metres: radiusMetres,
        distance_type: 'great_circle_to_mean_official_exit_location',
        total_returned: results.length,
        results,
        caveat: 'Use a routing service for walking distance, accessibility, or travel time.',
        ...responseSourceContext('lta_train_station_exits', 'lta_train_station_codes'),
      });
    },
  );

  server.registerTool(
    'rail_nearest_exits',
    {
      title: 'Find nearest Singapore rail station exits',
      description:
        'Find individual official MRT/LRT exit points by straight-line distance from Singapore coordinates.',
      inputSchema: z.object({
        latitude: singaporeLatitude,
        longitude: singaporeLongitude,
        radiusMetres: z.number().finite().min(25).max(10_000).default(2_000),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    },
    async ({ latitude, longitude, radiusMetres, limit }) => {
      const results = nearestByCoordinate(
        EXIT_POINTS,
        latitude,
        longitude,
        radiusMetres,
        limit,
      ).map(({ item, distanceMetres }) => {
        const station = STATION_BY_KEY.get(item.stationKey);
        return {
          distance_metres: Math.round(distanceMetres),
          station_name: station?.name ?? titleCaseStationName(item.stationKey),
          station_codes: station?.codes.map((code) => code.code) ?? [],
          system: item.system,
          exit_code: item.exitCode,
          latitude: item.latitude,
          longitude: item.longitude,
        };
      });
      return jsonResult({
        origin: { latitude, longitude },
        radius_metres: radiusMetres,
        distance_type: 'great_circle_to_official_exit_point',
        total_returned: results.length,
        results,
        caveat: 'Straight-line distance does not account for roads, barriers, or accessible paths.',
        ...responseSourceContext('lta_train_station_exits', 'lta_train_station_codes'),
      });
    },
  );

  server.registerTool(
    'rail_nearest_stations_to_address',
    {
      title: 'Find nearest Singapore rail stations to an address',
      description:
        'Resolve a Singapore address or postal code through OneMap, then find stations by straight-line distance to mean official exit locations. Requires ONEMAP_TOKEN.',
      inputSchema: z.object({
        query: z.string().trim().min(2).max(200),
        radiusMetres: z.number().finite().min(50).max(50_000).default(5_000),
        limit: z.number().int().min(1).max(25).default(5),
        system: z.enum(['all', 'MRT', 'LRT']).default('all'),
      }),
    },
    async ({ query, radiusMetres, limit, system }) => {
      const token = getOptionalEnv('ONEMAP_TOKEN');
      if (!token) {
        return errorResult(
          'Missing ONEMAP_TOKEN. Generate a token through the official OneMap API portal: https://www.onemap.gov.sg/apidocs/. Rail data coverage: station codes Jan 2025; exits Aug 2025 (publisher page updated Jul 2026). Address results are live, but rail distance is straight-line and not walking-route distance.',
        );
      }
      oneMapApi ??= new JsonHttpClient({
        baseUrl: 'https://www.onemap.gov.sg/api/',
        defaultHeaders: { authorization: `Bearer ${token}` },
        cacheTtlMs: 60_000,
      });
      let rawResponse: unknown;
      try {
        rawResponse = await oneMapApi.get('common/elastic/search', {
          searchVal: query,
          returnGeom: 'Y',
          getAddrDetails: 'Y',
          pageNum: 1,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown OneMap error';
        return errorResult(
          `OneMap address lookup failed: ${message}. Official API documentation: https://www.onemap.gov.sg/apidocs/. Rail coverage: station codes Jan 2025; exits Aug 2025 (publisher page updated Jul 2026). Rail distance is straight-line and not walking-route distance.`,
        );
      }
      const response = record(rawResponse);
      const results = Array.isArray(response?.results) ? response.results : [];
      const match = record(results[0]);
      const latitude = Number(match?.LATITUDE ?? match?.latitude);
      const longitude = Number(match?.LONGITUDE ?? match?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return jsonResult({
          found: false,
          query,
          hint: 'OneMap returned no geocoded result. Try a Singapore postal code or a more specific address.',
          geocoding_retrieved_at: new Date().toISOString(),
          ...responseSourceContext(
            'sla_onemap_search',
            'lta_train_station_exits',
            'lta_train_station_codes',
          ),
        });
      }
      const candidates =
        system === 'all'
          ? STATIONS
          : STATIONS.filter((station) => station.systems.includes(system));
      const nearest = nearestByCoordinate(candidates, latitude, longitude, radiusMetres, limit).map(
        ({ item, distanceMetres }) => ({
          distance_metres: Math.round(distanceMetres),
          ...stationSummary(item),
        }),
      );
      return jsonResult({
        found: true,
        query,
        geocoded_result: {
          search_value: match?.SEARCHVAL ?? match?.searchVal ?? null,
          address: match?.ADDRESS ?? match?.address ?? null,
          postal: match?.POSTAL ?? match?.postal ?? null,
          latitude,
          longitude,
        },
        geocoding_retrieved_at: new Date().toISOString(),
        radius_metres: radiusMetres,
        distance_type: 'great_circle_to_mean_official_exit_location',
        total_returned: nearest.length,
        results: nearest,
        caveat: 'Use OneMap routing for walking distance, barriers, accessibility, or travel time.',
        ...responseSourceContext(
          'sla_onemap_search',
          'lta_train_station_exits',
          'lta_train_station_codes',
        ),
      });
    },
  );

  server.registerTool(
    'rail_list_lines',
    {
      title: 'List official Singapore train line codes',
      description:
        'List the line-code and direction records in LTA’s February 2024 snapshot, enriched with station-code prefixes and current package counts.',
      inputSchema: z.object({ system: z.enum(['all', 'MRT', 'LRT']).default('all') }),
    },
    async ({ system }) => {
      const lines = LTA_LINE_ROWS.map(
        ([sourceOrder, lineCode, description, direction, shuttleDirection]) => ({
          source_order: sourceOrder,
          line_code: lineCode,
          description,
          system: /LRT/i.test(description) || ['PG', 'SK', 'BP'].includes(lineCode) ? 'LRT' : 'MRT',
          station_code_prefixes: LINE_PREFIXES[lineCode] ?? [],
          direction_snapshot: direction,
          shuttle_direction_snapshot: shuttleDirection,
          station_locations_in_combined_snapshot: STATIONS.filter((station) =>
            stationMatchesLine(station, lineCode),
          ).length,
        }),
      ).filter((line) => system === 'all' || line.system === system);
      return jsonResult({
        total_records: lines.length,
        results: lines,
        source_coverage: SOURCE_DATES.lineCodes,
        caveat:
          'The official file contains separate records for branches/loops and direction text may predate later extensions. This is not a live route planner.',
        ...responseSourceContext('lta_train_line_codes', 'lta_train_station_codes'),
      });
    },
  );

  server.registerTool(
    'rail_list_stations_by_line',
    {
      title: 'List stations on a Singapore rail line',
      description:
        'List stations using an official LTA line code, station-code prefix, or exact line name.',
      inputSchema: z.object({
        line: z.string().trim().min(1).max(80),
        ...paginationSchema,
      }),
    },
    async ({ line, offset, limit }) => {
      const stations = stationsForLine(line).map(stationSummary);
      return jsonResult({
        line,
        ...paginated(stations, offset, limit),
        ordering:
          'Alphabetical by station name. Branches and loops are grouped by official line code; this is not stop order.',
        source_coverage: SOURCE_DATES,
        ...responseSourceContext(
          'lta_train_line_codes',
          'lta_train_station_codes',
          'lta_train_station_exits',
        ),
      });
    },
  );

  server.registerTool(
    'rail_list_interchanges',
    {
      title: 'List Singapore rail interchanges',
      description:
        'List station complexes associated with more than one official line code in the January 2025 code snapshot.',
      inputSchema: z.object({
        includeMrtLrtConnections: z.boolean().default(true),
        ...paginationSchema,
      }),
    },
    async ({ includeMrtLrtConnections, offset, limit }) => {
      const stations = STATIONS.filter(
        (station) =>
          station.officialLineCodes.length > 1 &&
          (includeMrtLrtConnections || station.systems.length === 1),
      ).map(stationSummary);
      return jsonResult({
        ...paginated(stations, offset, limit),
        definition:
          'A station complex with codes mapped to more than one official line code in the source snapshot.',
        source_coverage: SOURCE_DATES.stationCodes,
        caveat:
          'This grouping is not a live confirmation of transfer availability or service status.',
        ...responseSourceContext('lta_train_station_codes', 'lta_train_station_exits'),
      });
    },
  );

  server.registerTool(
    'rail_historical_station_counts',
    {
      title: 'Get historical Singapore MRT and LRT station counts',
      description:
        'Return LTA’s published historical station-count series. Coverage is 2004–2017 and excludes 2015–2016 records.',
      inputSchema: z.object({
        fromYear: z.number().int().min(2004).max(2017).default(2004),
        toYear: z.number().int().min(2004).max(2017).default(2017),
      }),
    },
    async ({ fromYear, toYear }) => {
      const lower = Math.min(fromYear, toYear);
      const upper = Math.max(fromYear, toYear);
      const results = HISTORICAL_STATION_COUNTS.filter(
        ([year]) => year >= lower && year <= upper,
      ).map(([year, mrt, lrt]) => ({ year, mrt, lrt, total: mrt + lrt }));
      const publishedYears = new Set<number>(results.map((row) => row.year));
      const missingYears = Array.from(
        { length: upper - lower + 1 },
        (_, index) => lower + index,
      ).filter((year) => !publishedYears.has(year));
      return jsonResult({
        from_year: lower,
        to_year: upper,
        results,
        missing_years: missingYears,
        source_coverage: SOURCE_DATES.historicalCounts,
        caveat: 'The source ends in 2017 and must not be used as a current network count.',
        ...responseSourceContext('datagov_historical_station_counts'),
      });
    },
  );
}

export function createRailServer(): McpServer {
  const server = new McpServer(
    { name: '@olano/mcp-rail-sg', version: packageVersion(import.meta.url) },
    {
      instructions:
        'Read-only Singapore MRT/LRT station, exit, line-code, interchange, nearest-location, and historical-count tools based on dated official LTA/data.gov.sg snapshots. Treat distance as straight-line and never infer live service status.',
    },
  );
  registerRailTools(server);
  return server;
}
