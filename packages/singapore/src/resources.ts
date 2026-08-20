import type { McpServer } from '@modelcontextprotocol/server';

const sources = [
  {
    agency: 'Open Government Products / publishing agencies',
    service: 'data.gov.sg',
    url: 'https://guide.data.gov.sg/developer-guide/api-overview',
    credential: 'DATA_GOV_SG_API_KEY is optional but recommended for production',
  },
  {
    agency: 'Singapore Land Authority',
    service: 'OneMap',
    url: 'https://www.onemap.gov.sg/apidocs/',
    credential: 'ONEMAP_TOKEN for authenticated operations',
  },
  {
    agency: 'Land Transport Authority',
    service: 'DataMall',
    url: 'https://datamall.lta.gov.sg/content/datamall/en.html',
    credential: 'LTA_DATAMALL_API_KEY for dynamic APIs',
  },
  {
    agency: 'Singapore Department of Statistics',
    service: 'SingStat Table Builder',
    url: 'https://tablebuilder.singstat.gov.sg/',
    credential: 'none for supported public tables',
  },
  {
    agency: 'National Environment Agency',
    service: 'weather and air-quality feeds via data.gov.sg',
    url: 'https://www.weather.gov.sg/',
    credential: 'none for supported public real-time feeds',
  },
];

const promptExamples = `# Singapore MCP query examples

- Find official ACRA records for a company name or UEN.
- Show the latest available 4-room HDB resale transactions in Bedok and calculate median and quartiles with hdb_resale_stats.
- Show the latest COE premium and the bids-to-quota ratio for Category B.
- Which MRT/LRT stations and exits are nearest to these coordinates?
- List the published station codes and lines for Paya Lebar interchange.
- Compare CPI and retail-sales changes over matched monthly periods.
- Show current two-hour weather forecasts and PSI readings.
- Find MOE schools or ECDA centres matching a name or area.
- Show official SORA and bank interest-rate history, then stress-test a mortgage.
- Compare business formations and cessations over matched months.
- List more examples with the singapore_prompt_examples tool or olano-sg examples.
`;

export function registerSingaporeResources(server: McpServer): void {
  server.registerResource(
    'singapore-about',
    'singapore://about',
    {
      title: 'About the Olano Singapore MCP',
      description: 'Version, scope, transport and affiliation information.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: `# Olano Singapore MCP v0.3.0

Read-only MCP tools, prompts and resources for Singapore public APIs and datasets. The server supports stdio and Streamable HTTP and is maintained by Olano.

This is an independent community project. It is not affiliated with, endorsed by, or an official product of the Singapore Government or any government agency.
`,
        },
      ],
    }),
  );

  server.registerResource(
    'singapore-data-sources',
    'singapore://sources',
    {
      title: 'Singapore MCP official data sources',
      description: 'Official upstream services, documentation and credential requirements.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              retrieved_at: new Date().toISOString(),
              sources,
              licence: 'https://data.gov.sg/open-data-licence',
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    'singapore-query-examples',
    'singapore://examples',
    {
      title: 'Singapore MCP example questions',
      description: 'A compact set of user-facing questions across the MCP suite.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: promptExamples }],
    }),
  );
}
