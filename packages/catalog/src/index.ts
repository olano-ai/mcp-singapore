import type { McpServer } from '@modelcontextprotocol/server';
import {
  ApiError,
  assertSuccessfulEnvelope,
  getOptionalEnv,
  JsonHttpClient,
  jsonResult,
  readBoundedResponseText,
} from '@olano/mcp-core';
import * as z from 'zod/v4';
import { acraShardIds, datasetSpecs, singStatSpecs, type DatasetSpec } from './specs.js';

type Row = Record<string, unknown>;

function record(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
}

export function rowsFrom(value: unknown): Row[] {
  const root = record(value);
  validateEnvelope(root, 'data.gov.sg');
  if (Array.isArray(root.features)) {
    return root.features.flatMap((feature) => {
      const item = record(feature);
      if (!Object.keys(item).length) return [];
      return [{ ...record(item.properties), geometry: item.geometry ?? null }];
    });
  }
  const result = record(root.result);
  const data = record(root.data);
  const candidate = result.records ?? data.rows ?? root.rows;
  return Array.isArray(candidate)
    ? candidate.filter((row): row is Row => !!row && typeof row === 'object')
    : [];
}

export function validateEnvelope(value: unknown, provider: string): void {
  assertSuccessfulEnvelope(value, provider);
}

function headers(): Record<string, string> {
  const key = getOptionalEnv('DATA_GOV_SG_API_KEY');
  return key ? { 'x-api-key': key } : {};
}

function datastoreClient(): JsonHttpClient {
  return new JsonHttpClient({
    baseUrl: 'https://data.gov.sg/api/action/',
    defaultHeaders: headers(),
    cacheTtlMs: 60_000,
    minRequestIntervalMs: 250,
  });
}

function metadataClient(): JsonHttpClient {
  return new JsonHttpClient({
    baseUrl: 'https://api-production.data.gov.sg/v2/public/api/',
    defaultHeaders: headers(),
    cacheTtlMs: 3_600_000,
    minRequestIntervalMs: 250,
  });
}

function downloadClient(fetchImpl: typeof fetch = fetch): JsonHttpClient {
  return new JsonHttpClient({
    baseUrl: 'https://api-open.data.gov.sg/v1/public/api/',
    defaultHeaders: headers(),
    cacheTtlMs: 300_000,
    minRequestIntervalMs: 500,
    cacheNamespace: 'data-gov-sg-download-links',
    fetchImpl,
  });
}

function trustedDownloadUrl(value: unknown): URL {
  const url = new URL(String(value ?? ''));
  const trustedHost =
    url.hostname === 'storage.googleapis.com' ||
    url.hostname.endsWith('.amazonaws.com') ||
    url.hostname === 'data.gov.sg' ||
    url.hostname.endsWith('.data.gov.sg');
  if (url.protocol !== 'https:' || !trustedHost) {
    throw new ApiError('data.gov.sg returned an untrusted dataset download URL.');
  }
  return url;
}

export async function downloadJsonDataset(
  datasetId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const poll = await downloadClient(fetchImpl).get(`datasets/${datasetId}/poll-download`);
  validateEnvelope(poll, 'data.gov.sg poll-download');
  const url = trustedDownloadUrl(record(record(poll).data).url);
  const response = await fetchImpl(url, {
    headers: { accept: 'application/geo+json, application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new ApiError(`Dataset download returned HTTP ${response.status}.`, response.status);
  }
  const maximumBytes = 10_000_000;
  const text = await readBoundedResponseText(response, maximumBytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError('Dataset download returned invalid JSON.');
  }
}

function singStatClient(): JsonHttpClient {
  return new JsonHttpClient({
    baseUrl: 'https://tablebuilder.singstat.gov.sg/api/table/tabledata/',
    cacheTtlMs: 86_400_000,
    minRequestIntervalMs: 250,
  });
}

export function numericProfile(rows: Row[]): Record<string, unknown> {
  const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const numeric: Record<string, { count: number; min: number; max: number; mean: number }> = {};
  for (const field of fields) {
    const values = rows
      .map((row) => Number(String(row[field] ?? '').replaceAll(',', '')))
      .filter(Number.isFinite);
    if (!values.length) continue;
    const total = values.reduce((sum, value) => sum + value, 0);
    numeric[field] = {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: total / values.length,
    };
  }
  return { sample_size: rows.length, fields, numeric };
}

function normalizedDateCandidate(value: string): string | null {
  const compactTimestamp = /^(\d{4})(\d{2})(\d{2})\d{0,6}$/.exec(value);
  if (compactTimestamp)
    return `${compactTimestamp[1]}-${compactTimestamp[2]}-${compactTimestamp[3]}`;
  const monthNames: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };
  const monthly = /^(\d{4})[- _]?(\d{2}|[A-Za-z]{3})$/.exec(value);
  if (monthly) {
    const month = monthNames[monthly[2]!.toLowerCase()] ?? monthly[2];
    if (Number(month) >= 1 && Number(month) <= 12) return `${monthly[1]}-${month}-01`;
  }
  const quarterly = /^(\d{4})[- _]?Q([1-4])$/i.exec(value);
  if (quarterly)
    return `${quarterly[1]}-${String((Number(quarterly[2]) - 1) * 3 + 1).padStart(2, '0')}-01`;
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value : null;
}

function isObservationPeriodField(fieldName: string): boolean {
  if (/lease|birth|incorporat|registr|commence|expiry|completion|construction/i.test(fieldName))
    return false;
  return /(^|_)(date|time|timestamp|period|month|quarter|year|week|epi_week|as_of|updated|published|coverage)(_|$)|updatedat|lastupdated|coverageend|refperiod/i.test(
    fieldName,
  );
}

function findDates(value: unknown, depth = 0, fieldName = ''): string[] {
  if (depth > 5 || value === null || value === undefined) return [];
  if (typeof value === 'string') {
    if (!isObservationPeriodField(fieldName)) return [];
    const normalized = normalizedDateCandidate(value);
    return normalized ? [normalized] : [];
  }
  if (Array.isArray(value)) return value.flatMap((item) => findDates(item, depth + 1, fieldName));
  if (typeof value !== 'object') return [];
  return Object.entries(value as Row).flatMap(([key, item]) => {
    const dates = findDates(item, depth + 1, key);
    const dateFromField = normalizedDateCandidate(key);
    return dateFromField ? [dateFromField, ...dates] : dates;
  });
}

export function freshness(metadata: unknown, sampleRows: Row[]): Record<string, unknown> {
  const dates = [...findDates(metadata), ...findDates(sampleRows)]
    .map((value) => ({ value, timestamp: Date.parse(value) }))
    .filter((item) => Number.isFinite(item.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp);
  const latest = dates[0];
  if (!latest) return { latest_date: null, age_days: null, level: 'unknown' };
  const ageDays = Math.max(0, Math.floor((Date.now() - latest.timestamp) / 86_400_000));
  return {
    latest_date: latest.value,
    age_days: ageDays,
    level: ageDays <= 60 ? 'fresh' : ageDays <= 365 ? 'stale' : 'frozen',
  };
}

function registerDataset(server: McpServer, spec: DatasetSpec): void {
  const datastore = datastoreClient();
  const metadata = metadataClient();
  const source = `data.gov.sg dataset ${spec.datasetId} (${spec.agency})`;

  const loadRows = async (
    query: string | undefined,
    limit: number,
    offset: number,
    filters?: Record<string, string>,
    sort?: string,
  ): Promise<unknown> => {
    if (spec.format !== 'geojson') {
      return datastore.get('datastore_search', {
        resource_id: spec.datasetId,
        q: query,
        filters: filters && Object.keys(filters).length ? JSON.stringify(filters) : undefined,
        sort,
        limit,
        offset,
      });
    }

    const payload = await downloadJsonDataset(spec.datasetId);
    const allRows = rowsFrom(payload);
    const normalizedQuery = query?.trim().toLowerCase();
    const matchingRows = normalizedQuery
      ? allRows.filter((row) => JSON.stringify(row).toLowerCase().includes(normalizedQuery))
      : allRows;
    return {
      success: true,
      result: {
        resource_id: spec.datasetId,
        total: matchingRows.length,
        limit,
        offset,
        records: matchingRows.slice(offset, offset + limit),
      },
      source_format: 'geojson',
      retrieval: 'data.gov.sg poll-download',
    };
  };

  server.registerTool(
    `${spec.prefix}_metadata`,
    {
      title: `${spec.title}: metadata`,
      description: `Get official metadata and schema for ${spec.title}. Source: ${source}.`,
      inputSchema: z.object({}),
    },
    async () => jsonResult(await metadata.get(`datasets/${spec.datasetId}/metadata`)),
  );

  if (spec.prefix === 'hdb_resale') {
    server.registerTool(
      `${spec.prefix}_search`,
      {
        title: 'Search raw HDB resale transactions',
        description:
          'Retrieve official HDB resale rows using exact town, flat-type, month and street filters with deterministic sorting and pagination. For medians, quartiles, price ranges or latest-period aggregation, use hdb_resale_stats in the aggregate Singapore MCP.',
        inputSchema: z.object({
          query: z
            .string()
            .trim()
            .max(200)
            .optional()
            .describe(
              'Legacy data.gov.sg full-text query. Prefer the structured filters because multi-term q searches may be rejected upstream.',
            ),
          town: z.string().trim().min(2).max(80).optional(),
          flatType: z.string().trim().min(2).max(40).optional(),
          month: z
            .string()
            .regex(/^\d{4}-\d{2}$/)
            .optional(),
          street: z.string().trim().min(2).max(100).optional(),
          block: z.string().trim().min(1).max(20).optional(),
          flatModel: z.string().trim().min(2).max(80).optional(),
          sortOrder: z.enum(['asc', 'desc']).default('desc'),
          limit: z.number().int().min(1).max(100).default(25),
          offset: z.number().int().min(0).default(0),
        }),
      },
      async ({
        query,
        town,
        flatType,
        month,
        street,
        block,
        flatModel,
        sortOrder,
        limit,
        offset,
      }) => {
        const filters: Record<string, string> = {};
        if (town) filters.town = town.toUpperCase();
        if (flatType) filters.flat_type = flatType.toUpperCase();
        if (month) filters.month = month;
        if (street) filters.street_name = street.toUpperCase();
        if (block) filters.block = block.toUpperCase();
        if (flatModel) filters.flat_model = flatModel;
        return jsonResult(
          await loadRows(query, limit, offset, filters, `month ${sortOrder},_id ${sortOrder}`),
        );
      },
    );
  } else {
    server.registerTool(
      `${spec.prefix}_search`,
      {
        title: `Search ${spec.title}`,
        description: `Search and page through ${spec.title}. Source: ${source}.`,
        inputSchema: z.object({
          query: z.string().trim().max(200).optional(),
          limit: z.number().int().min(1).max(100).default(25),
          offset: z.number().int().min(0).default(0),
        }),
      },
      async ({ query, limit, offset }) => jsonResult(await loadRows(query, limit, offset)),
    );
  }

  server.registerTool(
    `${spec.prefix}_profile`,
    {
      title: `Profile ${spec.title}`,
      description: `Profile fields and numeric ranges from a bounded sample of ${spec.title}.`,
      inputSchema: z.object({ sampleSize: z.number().int().min(10).max(100).default(100) }),
    },
    async ({ sampleSize }) => {
      const payload = await loadRows(undefined, sampleSize, 0);
      return jsonResult({ dataset: spec, ...numericProfile(rowsFrom(payload)) });
    },
  );

  server.registerTool(
    `${spec.prefix}_freshness`,
    {
      title: `Check ${spec.title} freshness`,
      description: `Inspect official metadata and sample dates to flag stale or frozen data.`,
      inputSchema: z.object({}),
    },
    async () => {
      const [meta, payload] = await Promise.all([
        metadata.get(`datasets/${spec.datasetId}/metadata`),
        loadRows(undefined, 10, 0),
      ]);
      return jsonResult({
        dataset: spec,
        freshness: freshness(meta, rowsFrom(payload)),
        metadata: meta,
      });
    },
  );
}

function registerAcra(server: McpServer): void {
  const datastore = datastoreClient();
  server.registerTool(
    'acra_list_shards',
    {
      title: 'List ACRA entity shards',
      description: 'List the 27 official ACRA corporate-entity dataset shards on data.gov.sg.',
      inputSchema: z.object({}),
    },
    async () => jsonResult({ count: acraShardIds.length, dataset_ids: acraShardIds }),
  );

  const searchSchema = z.object({
    query: z.string().trim().min(2).max(200),
    limit: z.number().int().min(1).max(100).default(25),
    maxShards: z.number().int().min(1).max(27).default(27),
  });
  server.registerTool(
    'acra_search_entities',
    {
      title: 'Search ACRA corporate entities',
      description: 'Search official ACRA corporate-entity shards by company name, UEN, or text.',
      inputSchema: searchSchema,
    },
    async ({ query, limit, maxShards }) => {
      const matches: Row[] = [];
      for (const datasetId of acraShardIds.slice(0, maxShards)) {
        const payload = await datastore.get('datastore_search', {
          resource_id: datasetId,
          q: query,
          limit: Math.min(limit - matches.length, 25),
          offset: 0,
        });
        matches.push(...rowsFrom(payload));
        if (matches.length >= limit) break;
      }
      return jsonResult({ query, count: matches.length, rows: matches.slice(0, limit) });
    },
  );

  server.registerTool(
    'acra_get_entity',
    {
      title: 'Get ACRA entity by UEN',
      description: 'Resolve a Singapore corporate entity from official ACRA shards using its UEN.',
      inputSchema: z.object({ uen: z.string().trim().min(8).max(20) }),
    },
    async ({ uen }) => {
      for (const datasetId of acraShardIds) {
        const payload = await datastore.get('datastore_search', {
          resource_id: datasetId,
          q: uen,
          limit: 10,
          offset: 0,
        });
        const matches = rowsFrom(payload).filter((row) =>
          Object.values(row).some((value) => String(value).toUpperCase() === uen.toUpperCase()),
        );
        if (matches.length) return jsonResult({ uen, matches });
      }
      return jsonResult({ uen, matches: [] });
    },
  );

  server.registerTool(
    'acra_profile_entities',
    {
      title: 'Profile an ACRA shard',
      description: 'Profile a bounded sample from an official ACRA shard.',
      inputSchema: z.object({ shard: z.number().int().min(1).max(27).default(1) }),
    },
    async ({ shard }) => {
      const datasetId = acraShardIds[shard - 1];
      const payload = await datastore.get('datastore_search', {
        resource_id: datasetId,
        limit: 100,
        offset: 0,
      });
      return jsonResult({ shard, dataset_id: datasetId, ...numericProfile(rowsFrom(payload)) });
    },
  );
}

function singStatRows(payload: unknown): Row[] {
  validateEnvelope(payload, 'SingStat');
  const data = record(record(payload).Data);
  return Array.isArray(data.row)
    ? data.row.filter((row): row is Row => !!row && typeof row === 'object')
    : [];
}

function registerSingStat(server: McpServer): void {
  const client = singStatClient();
  for (const spec of singStatSpecs) {
    server.registerTool(
      `singstat_${spec.prefix}_latest`,
      {
        title: `${spec.title}: latest`,
        description: `Get the latest observations from SingStat table ${spec.tableId}.`,
        inputSchema: z.object({ series: z.string().trim().max(120).optional() }),
      },
      async ({ series }) => {
        const payload = await client.get(spec.tableId);
        let rows = singStatRows(payload);
        if (series)
          rows = rows.filter((row) =>
            String(row.rowText ?? '')
              .toLowerCase()
              .includes(series.toLowerCase()),
          );
        const latest = rows.map((row) => ({
          ...row,
          columns: Array.isArray(row.columns) ? row.columns.slice(0, 1) : [],
        }));
        return jsonResult({ table_id: spec.tableId, title: spec.title, rows: latest });
      },
    );

    server.registerTool(
      `singstat_${spec.prefix}_history`,
      {
        title: `${spec.title}: history`,
        description: `Get bounded historical observations from SingStat table ${spec.tableId}.`,
        inputSchema: z.object({
          series: z.string().trim().max(120).optional(),
          periods: z.number().int().min(1).max(120).default(24),
        }),
      },
      async ({ series, periods }) => {
        const payload = await client.get(spec.tableId);
        let rows = singStatRows(payload);
        if (series)
          rows = rows.filter((row) =>
            String(row.rowText ?? '')
              .toLowerCase()
              .includes(series.toLowerCase()),
          );
        return jsonResult({
          table_id: spec.tableId,
          title: spec.title,
          rows: rows.map((row) => ({
            ...row,
            columns: Array.isArray(row.columns) ? row.columns.slice(0, periods) : [],
          })),
        });
      },
    );
  }
}

export function registerCatalogTools(server: McpServer): void {
  server.registerTool(
    'singapore_catalog_list',
    {
      title: 'List curated Singapore datasets',
      description: 'List Olano curated data.gov.sg datasets and categories.',
      inputSchema: z.object({ category: z.string().trim().max(50).optional() }),
    },
    async ({ category }) =>
      jsonResult({
        datasets: category
          ? datasetSpecs.filter((spec) => spec.category === category)
          : datasetSpecs,
        singstat_tables: singStatSpecs,
        acra_shards: acraShardIds.length,
      }),
  );
  for (const spec of datasetSpecs) registerDataset(server, spec);
  registerAcra(server);
  registerSingStat(server);
}

export { acraShardIds, datasetSpecs, singStatSpecs } from './specs.js';
