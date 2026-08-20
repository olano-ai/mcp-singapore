import { McpServer } from '@modelcontextprotocol/server';
import { getOptionalEnv, JsonHttpClient, jsonResult } from '@olano/mcp-core';
import * as z from 'zod/v4';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/)
  .optional()
  .describe('Optional YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss filter.');

function client(): JsonHttpClient {
  const key = getOptionalEnv('DATA_GOV_SG_API_KEY');
  return new JsonHttpClient({
    baseUrl: 'https://api-open.data.gov.sg/v2/real-time/api/',
    ...(key ? { defaultHeaders: { 'x-api-key': key } } : {}),
    cacheTtlMs: 30_000,
  });
}

export function registerWeatherTools(server: McpServer): void {
  const api = client();
  const register = (name: string, title: string, description: string, endpoint: string) =>
    server.registerTool(
      name,
      { title, description, inputSchema: z.object({ date: dateSchema }) },
      async ({ date }) => jsonResult(await api.get(endpoint, { date })),
    );

  register(
    'weather_two_hour_forecast',
    'Get the 2-hour forecast',
    'Get area-level Singapore forecasts for the next two hours.',
    'two-hr-forecast',
  );
  register(
    'weather_twenty_four_hour_forecast',
    'Get the 24-hour forecast',
    'Get Singapore regional forecasts and temperature, humidity, and wind ranges.',
    'twenty-four-hr-forecast',
  );
  register(
    'weather_four_day_outlook',
    'Get the 4-day outlook',
    'Get Singapore weather outlooks for the next four days.',
    'four-day-outlook',
  );
  register(
    'weather_temperature',
    'Get current temperatures',
    'Get the latest temperature observations from Singapore weather stations.',
    'air-temperature',
  );
  register(
    'weather_rainfall',
    'Get current rainfall',
    'Get the latest rainfall observations from Singapore weather stations.',
    'rainfall',
  );
  register(
    'weather_air_quality',
    'Get current PSI',
    'Get Singapore Pollutant Standards Index readings and bands.',
    'psi',
  );
}

export function createWeatherServer(): McpServer {
  const server = new McpServer(
    { name: '@olano/mcp-weather', version: '0.2.0' },
    {
      instructions:
        'Read-only weather and air-quality data from NEA/MSS through data.gov.sg. Cite NEA and data.gov.sg when using returned data.',
    },
  );
  registerWeatherTools(server);
  return server;
}
