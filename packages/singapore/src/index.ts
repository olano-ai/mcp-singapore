import { McpServer } from '@modelcontextprotocol/server';
import { errorResult, getOptionalEnv, JsonHttpClient, jsonResult } from '@olano/mcp-core';
import { registerDataGovTools } from '@olano/mcp-datagov';
import { registerLtaTools } from '@olano/mcp-lta';
import { registerOneMapTools } from '@olano/mcp-onemap';
import { registerWeatherTools } from '@olano/mcp-weather';
import * as z from 'zod/v4';

export function createSingaporeServer(): McpServer {
  const server = new McpServer(
    { name: '@olano/mcp-singapore', version: '0.1.0' },
    {
      instructions:
        'Unified read-only access to Singapore public APIs. This community project is maintained by Olano and is not affiliated with or endorsed by the Singapore Government.',
    },
  );

  registerDataGovTools(server);
  registerOneMapTools(server);
  registerLtaTools(server);
  registerWeatherTools(server);

  server.registerTool(
    'singapore_location_brief',
    {
      title: 'Research a Singapore location',
      description:
        'Combine OneMap address results with the current two-hour Singapore weather forecast.',
      inputSchema: z.object({ query: z.string().trim().min(2).max(200) }),
    },
    async ({ query }) => {
      const oneMapToken = getOptionalEnv('ONEMAP_TOKEN');
      if (!oneMapToken) {
        return errorResult(
          'Missing required environment variable ONEMAP_TOKEN. The cross-agency location brief requires OneMap access.',
        );
      }
      const oneMap = new JsonHttpClient({
        baseUrl: 'https://www.onemap.gov.sg/api/',
        defaultHeaders: { authorization: `Bearer ${oneMapToken}` },
        cacheTtlMs: 60_000,
      });
      const weather = new JsonHttpClient({
        baseUrl: 'https://api-open.data.gov.sg/v2/real-time/api/',
        cacheTtlMs: 30_000,
      });
      const [locations, forecast] = await Promise.all([
        oneMap.get('common/elastic/search', {
          searchVal: query,
          returnGeom: 'Y',
          getAddrDetails: 'Y',
          pageNum: 1,
        }),
        weather.get('two-hr-forecast'),
      ]);
      return jsonResult({
        query,
        locations,
        forecast,
        sources: ['OneMap (SLA)', 'data.gov.sg / NEA'],
      });
    },
  );

  return server;
}
