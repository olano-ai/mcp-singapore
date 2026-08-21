import { McpServer, type RegisteredTool } from '@modelcontextprotocol/server';
import {
  JsonHttpClient,
  errorResult,
  getOptionalEnv,
  jsonResult,
  packageVersion,
} from '@olano/mcp-core';
import { registerDataGovTools } from '@olano/mcp-datagov';
import { registerLtaTools } from '@olano/mcp-lta';
import { registerOneMapTools } from '@olano/mcp-onemap';
import { registerWeatherTools } from '@olano/mcp-weather';
import {
  acraShardIds,
  datasetSpecs,
  registerCatalogTools,
  singStatSpecs,
} from '@olano/mcp-catalog';
import { registerSingaporeFinanceTools } from '@olano/mcp-finance-sg';
import { registerAnalyticsTools } from '@olano/mcp-analytics';
import { registerSingaporeInsightTools } from '@olano/mcp-insights-sg';
import { registerRailTools } from '@olano/mcp-rail-sg';
import * as z from 'zod/v4';
import {
  resolveSingaporeToolProfile,
  SINGAPORE_PROFILE_DISCOVERY_TOOL,
  SINGAPORE_TOOL_PROFILE_NAMES,
  SINGAPORE_TOOL_PROFILES,
  toolMatchesSingaporeProfile,
  type SingaporeToolProfile,
} from './profiles.js';
import { registerSingaporePrompts } from './prompts.js';
import { registerSingaporeResources } from './resources.js';

export {
  resolveSingaporeToolProfile,
  SINGAPORE_PROFILE_DISCOVERY_TOOL,
  SINGAPORE_TOOL_PROFILE_NAMES,
  SINGAPORE_TOOL_PROFILES,
  toolMatchesSingaporeProfile,
};
export type {
  SingaporeToolProfile,
  SingaporeToolProfileDefinition,
  SingaporeToolProfileName,
} from './profiles.js';

export interface SingaporeServerOptions {
  profile?: SingaporeToolProfile;
}

function createProfiledRegistrationServer(
  server: McpServer,
  profile: SingaporeToolProfile,
  attemptedToolNames: Set<string>,
): McpServer {
  const registerTool = server.registerTool.bind(server) as unknown as (
    name: string,
    ...args: unknown[]
  ) => RegisteredTool;

  return new Proxy(server, {
    get(target, property, receiver) {
      if (property === 'registerTool') {
        return (name: string, ...args: unknown[]) => {
          attemptedToolNames.add(name);
          const registered = registerTool(name, ...args);
          if (!toolMatchesSingaporeProfile(name, profile)) registered.disable();
          return registered;
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export function createSingaporeServer(options: SingaporeServerOptions = {}): McpServer {
  const profile = resolveSingaporeToolProfile(options.profile);
  const server = new McpServer(
    { name: '@olano/mcp-singapore', version: packageVersion(import.meta.url) },
    {
      instructions: `Unified read-only access to Singapore public APIs. Active tool profile: ${profile}. Prefer the most specific Olano tool for filtered or derived questions instead of bypassing the MCP with a direct API request. For filtered HDB resale transactions, latest-period results, medians or quartiles, call hdb_resale_stats; hdb_resale_search is the raw paginated row reader. This community project is maintained by Olano and is not affiliated with or endorsed by the Singapore Government.`,
    },
  );
  const attemptedToolNames = new Set<string>();
  const registrationServer = createProfiledRegistrationServer(server, profile, attemptedToolNames);

  registerDataGovTools(registrationServer);
  registerOneMapTools(registrationServer);
  registerLtaTools(registrationServer);
  registerWeatherTools(registrationServer);
  registerCatalogTools(registrationServer);
  registerSingaporeFinanceTools(registrationServer);
  registerAnalyticsTools(registrationServer);
  registerSingaporeInsightTools(registrationServer);
  registerRailTools(registrationServer);
  registerSingaporePrompts(server);
  registerSingaporeResources(server);

  registrationServer.registerTool(
    'singapore_cache_info',
    {
      title: 'Inspect cache configuration',
      description: 'Show whether the optional persistent public-response cache is enabled.',
      inputSchema: z.object({}),
    },
    async () => {
      const directory = getOptionalEnv('OLANO_SG_CACHE_DIR');
      return jsonResult({
        persistent_cache_enabled: Boolean(directory),
        directory: directory ? '[configured]' : null,
        behavior:
          'Responses use provider-specific TTLs. Cache keys and request-header identity are hashed, and source metadata omits the entire query string. Payloads may still contain request results; do not share the directory across untrusted tenants.',
      });
    },
  );

  registrationServer.registerTool(
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

  registrationServer.registerTool(
    'singapore_company_brief',
    {
      title: 'Research a Singapore company',
      description:
        'Combine official ACRA public-entity matches with current SingStat business-formation context.',
      inputSchema: z.object({
        query: z.string().trim().min(2).max(200),
        maxShards: z.number().int().min(1).max(27).default(27),
      }),
    },
    async ({ query, maxShards }) => {
      const dataGovKey = getOptionalEnv('DATA_GOV_SG_API_KEY');
      const dataGov = new JsonHttpClient({
        baseUrl: 'https://data.gov.sg/api/action/',
        defaultHeaders: dataGovKey ? { 'x-api-key': dataGovKey } : {},
        cacheTtlMs: 60_000,
        minRequestIntervalMs: 250,
      });
      const singStat = new JsonHttpClient({
        baseUrl: 'https://tablebuilder.singstat.gov.sg/api/table/tabledata/',
        cacheTtlMs: 86_400_000,
        minRequestIntervalMs: 250,
      });
      const matches: unknown[] = [];
      for (const datasetId of acraShardIds.slice(0, maxShards)) {
        const payload = (await dataGov.get('datastore_search', {
          resource_id: datasetId,
          q: query,
          limit: 10,
          offset: 0,
        })) as { result?: { records?: unknown[] } };
        matches.push(...(payload.result?.records ?? []));
        if (matches.length >= 25) break;
      }
      const formationTable = singStatSpecs.find(
        (spec) => spec.prefix === 'business_formations_monthly',
      );
      const formationContext = formationTable ? await singStat.get(formationTable.tableId) : null;
      return jsonResult({
        query,
        entity_matches: matches.slice(0, 25),
        business_formation_context: formationContext,
        sources: ['ACRA datasets on data.gov.sg', `SingStat ${formationTable?.tableId ?? ''}`],
        caveat:
          'A name match is not identity confirmation. Public entity data does not establish ownership, solvency, licensing, or trustworthiness.',
      });
    },
  );

  registrationServer.registerTool(
    'singapore_property_area_brief',
    {
      title: 'Research a Singapore property area',
      description:
        'Combine HDB or URA public transaction evidence with optional OneMap address context.',
      inputSchema: z.object({
        query: z.string().trim().min(2).max(200),
        market: z.enum(['hdb', 'private']).default('hdb'),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    },
    async ({ query, market, limit }) => {
      const dataGovKey = getOptionalEnv('DATA_GOV_SG_API_KEY');
      const dataGov = new JsonHttpClient({
        baseUrl: 'https://data.gov.sg/api/action/',
        defaultHeaders: dataGovKey ? { 'x-api-key': dataGovKey } : {},
        cacheTtlMs: 60_000,
        minRequestIntervalMs: 250,
      });
      const spec = datasetSpecs.find((item) =>
        market === 'hdb' ? item.prefix === 'hdb_resale' : item.prefix === 'ura_private_property',
      );
      if (!spec) return errorResult(`No ${market} property dataset is configured.`);
      const transactions = await dataGov.get('datastore_search', {
        resource_id: spec.datasetId,
        q: query,
        limit,
        offset: 0,
      });
      const oneMapToken = getOptionalEnv('ONEMAP_TOKEN');
      let locations: unknown = null;
      if (oneMapToken) {
        const oneMap = new JsonHttpClient({
          baseUrl: 'https://www.onemap.gov.sg/api/',
          defaultHeaders: { authorization: `Bearer ${oneMapToken}` },
          cacheTtlMs: 60_000,
        });
        locations = await oneMap.get('common/elastic/search', {
          searchVal: query,
          returnGeom: 'Y',
          getAddrDetails: 'Y',
          pageNum: 1,
        });
      }
      return jsonResult({
        query,
        market,
        locations,
        transactions,
        source: `data.gov.sg dataset ${spec.datasetId} (${spec.agency})`,
        one_map_status: oneMapToken
          ? 'included'
          : 'not included; set ONEMAP_TOKEN for address context',
        caveat:
          'Transaction matches are evidence, not a professional valuation or an offer-price recommendation.',
      });
    },
  );

  registrationServer.registerTool(
    'singapore_market_context',
    {
      title: 'Get Singapore market context',
      description:
        'Retrieve bounded official observations for GDP, CPI, retail sales, employment, income and exchange rates in one call.',
      inputSchema: z.object({
        observationsPerDataset: z.number().int().min(1).max(20).default(5),
      }),
    },
    async ({ observationsPerDataset }) => {
      const prefixes = [
        'gdp_growth',
        'cpi',
        'retail_sales',
        'employment_sector',
        'median_income',
        'mas_fx',
      ];
      const selected = datasetSpecs.filter((spec) => prefixes.includes(spec.prefix));
      const dataGovKey = getOptionalEnv('DATA_GOV_SG_API_KEY');
      const dataGov = new JsonHttpClient({
        baseUrl: 'https://data.gov.sg/api/action/',
        defaultHeaders: dataGovKey ? { 'x-api-key': dataGovKey } : {},
        cacheTtlMs: 60_000,
        minRequestIntervalMs: 250,
      });
      const series = await Promise.all(
        selected.map(async (spec) => ({
          dataset: spec,
          observations: await dataGov.get('datastore_search', {
            resource_id: spec.datasetId,
            limit: observationsPerDataset,
            offset: 0,
          }),
        })),
      );
      return jsonResult({
        series,
        caveat:
          'Align periods and units before comparison. This context is descriptive and is not an investment forecast.',
      });
    },
  );

  const availableProfiles: SingaporeToolProfile[] = ['all', ...SINGAPORE_TOOL_PROFILE_NAMES];
  const toolsForProfile = (selectedProfile: SingaporeToolProfile) =>
    [
      ...[...attemptedToolNames].filter((name) =>
        toolMatchesSingaporeProfile(name, selectedProfile),
      ),
      SINGAPORE_PROFILE_DISCOVERY_TOOL,
    ].sort();

  server.registerTool(
    SINGAPORE_PROFILE_DISCOVERY_TOOL,
    {
      title: 'Discover Singapore MCP tool profiles',
      description:
        'List the stable server-side tool profiles, their prefix contracts and exact tool counts. Optionally return the tool names for one profile.',
      inputSchema: z.object({
        profile: z.enum(availableProfiles).optional(),
        includeTools: z.boolean().default(false),
      }),
    },
    async ({ profile: requestedProfile, includeTools }) => {
      const selectedProfile = requestedProfile ?? profile;
      const selectedTools = toolsForProfile(selectedProfile);
      return jsonResult({
        active_profile: profile,
        selected_profile: selectedProfile,
        selected_tool_count: selectedTools.length,
        tools: includeTools ? selectedTools : undefined,
        profiles: Object.fromEntries(
          availableProfiles.map((name) => {
            const definition =
              name === 'all'
                ? {
                    description: 'Every tool in the aggregate Singapore MCP server.',
                    prefixes: ['*'],
                  }
                : SINGAPORE_TOOL_PROFILES[name];
            return [
              name,
              {
                description: definition.description,
                prefixes: definition.prefixes,
                tool_count: toolsForProfile(name).length,
              },
            ];
          }),
        ),
        note: `${SINGAPORE_PROFILE_DISCOVERY_TOOL} is always available and is included in every count. MCP prompts and resources are preserved by every profile.`,
      });
    },
  );

  return server;
}
