import { McpServer } from '@modelcontextprotocol/server';
import {
  JsonHttpClient,
  errorResult,
  getOptionalEnv,
  jsonResult,
  packageVersion,
} from '@olano/mcp-core';
import * as z from 'zod/v4';

function client(apiKey: string): JsonHttpClient {
  return new JsonHttpClient({
    baseUrl: 'https://datamall2.mytransport.sg/ltaodataservice/',
    defaultHeaders: { AccountKey: apiKey },
    cacheTtlMs: 30_000,
  });
}

export function registerLtaTools(server: McpServer): void {
  let api: JsonHttpClient | undefined;
  const request = async (path: string, query: Record<string, string | number | undefined> = {}) => {
    const apiKey = getOptionalEnv('LTA_DATAMALL_API_KEY');
    if (!apiKey) {
      return errorResult(
        'Missing required environment variable LTA_DATAMALL_API_KEY. Request an Account Key from LTA DataMall.',
      );
    }
    api ??= client(apiKey);
    return jsonResult(await api.get(path, query));
  };

  server.registerTool(
    'lta_bus_arrivals',
    {
      title: 'Get live bus arrivals',
      description: 'Get real-time bus arrival estimates for an LTA bus stop code.',
      inputSchema: z.object({
        busStopCode: z.string().regex(/^\d{5}$/),
        serviceNumber: z
          .string()
          .regex(/^[A-Za-z0-9]{1,4}$/)
          .optional(),
      }),
    },
    async ({ busStopCode, serviceNumber }) =>
      request('v3/BusArrival', { BusStopCode: busStopCode, ServiceNo: serviceNumber }),
  );

  server.registerTool(
    'lta_list_bus_stops',
    {
      title: 'List Singapore bus stops',
      description: 'List LTA bus stops in pages of 500 records.',
      inputSchema: z.object({ skip: z.number().int().min(0).multipleOf(500).default(0) }),
    },
    async ({ skip }) => request('BusStops', { $skip: skip }),
  );

  server.registerTool(
    'lta_traffic_incidents',
    {
      title: 'Get current traffic incidents',
      description:
        'Get accidents, breakdowns, road blocks, diversions, and other current incidents.',
      inputSchema: z.object({}),
    },
    async () => request('TrafficIncidents'),
  );

  server.registerTool(
    'lta_traffic_images',
    {
      title: 'Get live traffic camera images',
      description:
        'Get LTA links and coordinates for current expressway and checkpoint traffic images.',
      inputSchema: z.object({}),
    },
    async () => request('Traffic-Imagesv2'),
  );

  server.registerTool(
    'lta_carpark_availability',
    {
      title: 'Get carpark availability',
      description: 'Get current availability for participating HDB, LTA, and URA carparks.',
      inputSchema: z.object({}),
    },
    async () => request('CarParkAvailabilityv2'),
  );

  server.registerTool(
    'lta_taxi_availability',
    {
      title: 'Get available taxi locations',
      description: 'Get coordinates of taxis currently reported as available for hire.',
      inputSchema: z.object({}),
    },
    async () => request('Taxi-Availability'),
  );
}

export function createLtaServer(): McpServer {
  const server = new McpServer(
    { name: '@olano/mcp-lta', version: packageVersion(import.meta.url) },
    { instructions: 'Read-only access to LTA DataMall. Every tool requires LTA_DATAMALL_API_KEY.' },
  );
  registerLtaTools(server);
  return server;
}
