import { McpServer } from '@modelcontextprotocol/server';
import { errorResult, getOptionalEnv, JsonHttpClient, jsonResult } from '@olano/mcp-core';
import * as z from 'zod/v4';

const coordinate = z.number().finite();

function client(token: string): JsonHttpClient {
  return new JsonHttpClient({
    baseUrl: 'https://www.onemap.gov.sg/api/',
    defaultHeaders: { authorization: `Bearer ${token}` },
    cacheTtlMs: 60_000,
  });
}

export function registerOneMapTools(server: McpServer): void {
  let api: JsonHttpClient | undefined;
  const request = async (path: string, query: Record<string, string | number | undefined>) => {
    const token = getOptionalEnv('ONEMAP_TOKEN');
    if (!token) {
      return errorResult(
        'Missing required environment variable ONEMAP_TOKEN. Register an account and generate a token through the OneMap API portal.',
      );
    }
    api ??= client(token);
    return jsonResult(await api.get(path, query));
  };

  server.registerTool(
    'onemap_search',
    {
      title: 'Search Singapore addresses',
      description:
        'Search OneMap for Singapore addresses, buildings, roads, postal codes, and POIs.',
      inputSchema: z.object({
        query: z.string().trim().min(2).max(200),
        page: z.number().int().min(1).default(1),
        includeGeometry: z.boolean().default(false),
      }),
    },
    async ({ query, page, includeGeometry }) =>
      request('common/elastic/search', {
        searchVal: query,
        returnGeom: includeGeometry ? 'Y' : 'N',
        getAddrDetails: 'Y',
        pageNum: page,
      }),
  );

  server.registerTool(
    'onemap_reverse_geocode',
    {
      title: 'Reverse geocode Singapore coordinates',
      description: 'Resolve WGS84 latitude and longitude to nearby Singapore address information.',
      inputSchema: z.object({
        latitude: coordinate.min(1.1).max(1.6),
        longitude: coordinate.min(103.5).max(104.1),
        bufferMetres: z.number().int().min(0).max(500).default(40),
      }),
    },
    async ({ latitude, longitude, bufferMetres }) =>
      request('public/revgeocode', {
        location: `${latitude},${longitude}`,
        buffer: bufferMetres,
        addressType: 'All',
        otherFeatures: 'N',
      }),
  );

  server.registerTool(
    'onemap_route',
    {
      title: 'Plan a route in Singapore',
      description: 'Calculate a OneMap route between two WGS84 coordinates.',
      inputSchema: z.object({
        startLatitude: coordinate.min(1.1).max(1.6),
        startLongitude: coordinate.min(103.5).max(104.1),
        endLatitude: coordinate.min(1.1).max(1.6),
        endLongitude: coordinate.min(103.5).max(104.1),
        routeType: z.enum(['walk', 'drive', 'cycle', 'pt']).default('walk'),
      }),
    },
    async ({ startLatitude, startLongitude, endLatitude, endLongitude, routeType }) => {
      return request('public/routingsvc/route', {
        start: `${startLatitude},${startLongitude}`,
        end: `${endLatitude},${endLongitude}`,
        routeType,
      });
    },
  );
}

export function createOneMapServer(): McpServer {
  const server = new McpServer(
    { name: '@olano/mcp-onemap', version: '0.3.0' },
    {
      instructions:
        'Read-only access to Singapore Land Authority OneMap APIs. Every tool requires ONEMAP_TOKEN. Results use OneMap data and are not an endorsement by SLA.',
    },
  );
  registerOneMapTools(server);
  return server;
}
