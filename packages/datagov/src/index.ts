import { McpServer } from '@modelcontextprotocol/server';
import { getOptionalEnv, JsonHttpClient, jsonResult } from '@olano/mcp-core';
import * as z from 'zod/v4';

const DATASET_BASE_URL = 'https://api-production.data.gov.sg/v2/public/api/';
const REALTIME_BASE_URL = 'https://api-open.data.gov.sg/v2/real-time/api/';

const realtimeApi = z.enum([
  'air-temperature',
  'four-day-outlook',
  'pm25',
  'psi',
  'rainfall',
  'relative-humidity',
  'twenty-four-hr-forecast',
  'two-hr-forecast',
  'uv',
  'wind-direction',
  'wind-speed',
]);

function clients() {
  const apiKey = getOptionalEnv('DATA_GOV_SG_API_KEY');
  const headers = apiKey ? { 'x-api-key': apiKey } : undefined;
  return {
    datasets: new JsonHttpClient({
      baseUrl: DATASET_BASE_URL,
      ...(headers ? { defaultHeaders: headers } : {}),
      cacheTtlMs: 60_000,
    }),
    realtime: new JsonHttpClient({
      baseUrl: REALTIME_BASE_URL,
      ...(headers ? { defaultHeaders: headers } : {}),
      cacheTtlMs: 30_000,
    }),
  };
}

export function registerDataGovTools(server: McpServer): void {
  const api = clients();

  server.registerTool(
    'datagov_list_datasets',
    {
      title: 'List data.gov.sg datasets',
      description:
        'List datasets published on data.gov.sg. Use pagination to keep responses small.',
      inputSchema: z.object({
        page: z.number().int().min(1).default(1),
      }),
    },
    async ({ page }) => jsonResult(await api.datasets.get('datasets', { page })),
  );

  server.registerTool(
    'datagov_get_dataset_metadata',
    {
      title: 'Get data.gov.sg dataset metadata',
      description: 'Retrieve metadata for a data.gov.sg dataset ID such as d_abc123.',
      inputSchema: z.object({ datasetId: z.string().regex(/^d_[A-Za-z0-9]+$/) }),
    },
    async ({ datasetId }) => jsonResult(await api.datasets.get(`datasets/${datasetId}/metadata`)),
  );

  server.registerTool(
    'datagov_list_dataset_rows',
    {
      title: 'List rows from a data.gov.sg dataset',
      description: 'Read a paginated set of rows from a data.gov.sg dataset.',
      inputSchema: z.object({
        datasetId: z.string().regex(/^d_[A-Za-z0-9]+$/),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    },
    async ({ datasetId, page, limit }) =>
      jsonResult(await api.datasets.get(`datasets/${datasetId}/list-rows`, { page, limit })),
  );

  server.registerTool(
    'datagov_get_realtime',
    {
      title: 'Get a data.gov.sg real-time feed',
      description: 'Retrieve a supported Singapore weather or air-quality real-time feed.',
      inputSchema: z.object({
        api: realtimeApi,
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/)
          .optional()
          .describe('Optional YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss filter.'),
      }),
    },
    async ({ api: endpoint, date }) => jsonResult(await api.realtime.get(endpoint, { date })),
  );
}

export function createDataGovServer(): McpServer {
  const server = new McpServer(
    { name: '@olano/mcp-datagov', version: '0.1.0' },
    {
      instructions:
        'Read-only access to documented public data.gov.sg APIs. Cite data.gov.sg and the source agency when using returned data.',
    },
  );
  registerDataGovTools(server);
  return server;
}
