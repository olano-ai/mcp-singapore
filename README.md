# 🇸🇬 Singapore MCP

Open-source Model Context Protocol servers, tools, prompts, resources, skills, and a CLI for
Singapore public data and services.

Built and maintained in Singapore by [Olano](https://olano.ai).

> Singapore MCP is an independent community project. It is not affiliated with, endorsed by, or an
> official product of the Singapore Government or any government agency. “Official” below describes
> an upstream data source, not this software.

## What ships

The monorepo separates provider access, reusable analysis, and user-facing workflows. Install the
aggregate server for the complete experience or a focused executable when you only need one
provider.

| Package                  | Role                                                                                                                      | Credentials                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `@olano/mcp-singapore`   | Aggregate server: every provider, catalog, insight, rail, finance, analytics, prompt, resource, and cross-agency workflow | Depends on the selected tool          |
| `@olano/mcp-datagov`     | data.gov.sg catalog, metadata, rows, and real-time feeds                                                                  | Optional data.gov.sg key              |
| `@olano/mcp-onemap`      | OneMap address search, reverse geocoding, and routing                                                                     | OneMap token                          |
| `@olano/mcp-lta`         | LTA DataMall bus arrivals, traffic, parking, and taxi feeds                                                               | LTA DataMall Account Key              |
| `@olano/mcp-weather`     | Forecasts, temperature, rainfall, and PSI                                                                                 | Optional data.gov.sg key              |
| `@olano/mcp-catalog`     | Curated Singapore datasets, 27 ACRA entity shards, and SingStat tables                                                    | Optional data.gov.sg key              |
| `@olano/mcp-insights-sg` | Prompt discovery, semantic routing, period-aware comparisons, and derived public-data insights                            | Depends on the routed source          |
| `@olano/mcp-rail-sg`     | MRT/LRT stations, codes, lines, exits, interchanges, and nearest-location tools                                           | None; OneMap token for address lookup |
| `@olano/mcp-finance-sg`  | Official mortgage reference-rate history and transparent local mortgage calculations                                      | Optional data.gov.sg key              |
| `@olano/mcp-analytics`   | Deterministic local statistics, comparisons, correlations, and text sparklines                                            | None                                  |
| `@olano/mcp-core`        | Shared transport, safe HTTP client, caching, retries, and MCP result helpers                                              | None                                  |
| `@olano/sg-cli`          | Search, inspect, route, and invoke the complete suite from a terminal                                                     | Depends on the selected tool          |

Focused stdio/HTTP executables are available for the aggregate, data.gov.sg, OneMap, LTA, weather,
and rail packages. The other packages are reusable registration libraries composed by the aggregate
server.

## Quick start

### MCP over stdio

```bash
npx -y @olano/mcp-singapore
```

Add it to a client that accepts the common `mcpServers` format:

```json
{
  "mcpServers": {
    "singapore": {
      "command": "npx",
      "args": ["-y", "@olano/mcp-singapore"],
      "env": {
        "DATA_GOV_SG_API_KEY": "optional-data-gov-key",
        "ONEMAP_TOKEN": "your-onemap-token",
        "LTA_DATAMALL_API_KEY": "your-lta-account-key",
        "OLANO_SG_CACHE_DIR": "/absolute/path/to/olano-sg-cache"
      }
    }
  }
}
```

Remove credentials you do not use and never commit real values. The server starts without any
credential; only tools that require one will return a missing-credential error.

### Smaller server-side tool profiles

The aggregate defaults to `all`. To reduce the tool definitions sent to a model, select a focused
production profile without losing MCP prompts or resources:

```bash
npx -y @olano/mcp-singapore --profile mobility
OLANO_SG_PROFILE=property npx -y @olano/mcp-singapore
```

The stable profiles are `mobility`, `property`, `business`, `economy`, `civic`, and `finance`.
`singapore_tool_profiles` is always available and returns each profile's prefix contract, exact live
tool count, and optional tool-name inventory. The same definitions power `olano-sg profiles` and
`olano-sg profile <name>`. An unknown profile fails at startup instead of silently falling back to
`all`.

### MCP over Streamable HTTP

```bash
npx -y @olano/mcp-singapore --transport http --host 127.0.0.1 --port 3000
```

The MCP endpoint is `http://127.0.0.1:3000/mcp`. Localhost is the default bind address. Add TLS,
authentication, request limits, and operational monitoring before exposing it to a network.

Focused servers use the same flags:

```bash
npx -y @olano/mcp-rail-sg --transport http --port 3001
npx -y @olano/mcp-weather --transport http --port 3002
```

### CLI

The npm package is `@olano/sg-cli`; its executable is `olano-sg`.

```bash
npx -y @olano/sg-cli list
npx -y @olano/sg-cli search rail
npx -y @olano/sg-cli examples
npx -y @olano/sg-cli examples property
npx -y @olano/sg-cli ask "Compare recent HDB resale prices in Bedok"
npx -y @olano/sg-cli datasets economy
npx -y @olano/sg-cli prompts
npx -y @olano/sg-cli tool weather_two_hour_forecast '{}'
npx -y @olano/sg-cli setup claude property
npx -y @olano/sg-cli doctor claude property
```

`ask` and its `query` alias use a deterministic local router. They recommend tools, extract obvious
arguments, and report missing inputs; they do not send the question to an external model or silently
execute the recommendation. Use `tool` for an explicit invocation.

### Claude Code plugins

This repository is also the installable Claude Code marketplace `olano`:

```text
/plugin marketplace add olano-ai/mcp-singapore
/plugin install olano-singapore-property@olano
```

Choose the complete `olano-singapore` plugin or a focused `property`, `mobility`, `business`,
`economy`, `civic`, or `finance` plugin. Each plugin starts the matching MCP profile automatically
and bundles focused Agent Skills. Optional API values are declared as sensitive Claude Code user
configuration. See [Claude Code plugins](docs/claude-code.md) for the complete matrix, CLI setup,
credential handling, updates, and validation.

## Example questions

Ask these in an MCP client, or use `olano-sg examples [category]` to browse the packaged prompt
catalog. Results depend on upstream coverage and any credentials shown above.

### Companies and ACRA

- “Find the official public ACRA records matching `Olano` and show the UEN and entity status.”
- “Look up this exact UEN across all ACRA shards; make any match uncertainty explicit.”
- “Compare monthly business formations and cessations, then calculate net formations.”
- “How have formations changed for two SSIC sectors over matched periods?”

### HDB and private property

- “Show recent 4-room HDB resale transactions in Bedok and calculate the median and quartiles.”
- “Compare HDB resale price per square metre between Tampines and Jurong East.”
- “Find HDB carparks whose address contains `Bishan` and group them by carpark type.”
- “Show bounded private-property transaction evidence for a project or district.”
- “Build a property-area brief for Queenstown with OneMap location context.”

The first example is a single MCP operation. `hdb_resale_stats` applies the exact town and flat-type
filters, selects the latest available matching month by default, returns the transaction rows, and
calculates the range, median, Q1, Q3, and price per square metre inside the server:

```bash
npx -y @olano/sg-cli tool hdb_resale_stats '{"town":"BEDOK","flatType":"4 ROOM"}'
```

Use `latestMonths`, `startMonth`, or `endMonth` to choose a different period. A direct dataset
download is not required. This operation is available in the aggregate server's `all` and
`property` profiles; it is not part of the focused `@olano/mcp-datagov` row-reader package.

### COE, buses, roads, parking, and taxis

- “What is the latest Category B COE premium, quota, number of bids, and bid-to-quota ratio?”
- “Show the last 12 Category A bidding exercises and changes from the prior premium.”
- “When are the next buses arriving at this bus stop?”
- “List current traffic incidents and nearby traffic-camera images.”
- “Show live LTA carpark availability and taxi availability.”

### MRT and LRT

- “What are the MRT/LRT codes and line connections for Paya Lebar?”
- “List every station on the Thomson-East Coast Line.”
- “Which official station exits belong to City Hall?”
- “Find the five nearest rail stations to latitude 1.29027, longitude 103.851959.”
- “Find rail stations near `1 Fullerton Road` and state whether distance is straight-line or walking.”
- “List MRT/LRT interchanges and show the date of each bundled source snapshot.”

### Weather, PSI, rainfall, and dengue

- “Show the current two-hour forecast for Singapore areas.”
- “What are the latest temperature and rainfall readings by station?”
- “Show the 24-hour forecast, four-day outlook, and latest PSI readings.”
- “Find current dengue-cluster records and include the dataset freshness.”

### Education and childcare

- “Find MOE schools matching `Nanyang` and show the official dataset fields.”
- “Find ECDA childcare centres in an area and summarise any published vacancy fields.”
- “Resolve this address with OneMap before comparing nearby school or childcare records.”

### GDP, prices, labour, income, FX, tax, and trade

- “Show the latest GDP growth observations and compare selected industries.”
- “Calculate year-on-year CPI change using the same month, not adjacent months.”
- “Compare retail-sales year-on-year change with CPI over matched monthly periods.”
- “Show median-income history, employment by sector, and calculated employment growth.”
- “Show unemployment and resident labour-force participation history.”
- “Find official MAS exchange-rate observations and preserve each published unit.”
- “Show IRAS tax-collection history and calculate category shares only where units match.”
- “Show Singapore merchandise-trade history from SingStat.”

### Tourism, population, health, energy, crime, and hawkers

- “Rank visitor-arrival source markets for the latest published period.”
- “Show tourism receipts history and warn me if the curated dataset is stale.”
- “Compare population, live births, deaths, marriages, and divorces over available periods.”
- “Show disease-case history, its last observation, and a clear frozen-data warning if applicable.”
- “Show electricity-generation history and the source agency.”
- “Compare like-for-like recorded-crime series without inferring neighbourhood or individual risk.”
- “Find NEA hawker centres matching `Maxwell` and profile the published fields.”

### Mortgage reference rates

- “Show the latest official SORA and published housing-loan reference-rate series.”
- “Show 24 months of official mortgage reference-rate context and identify the latest period.”
- “At a user-supplied illustrative rate, calculate the monthly payment on a S$600,000 mortgage.”
- “Stress-test that mortgage at 2.5%, 3.5%, and 4.5%, with assumptions shown.”

These are official reference-rate statistics and educational calculations, not live lender offers,
credit decisions, or personal financial advice.

### Cross-series analysis and discovery

- “Align these quarterly GDP and monthly CPI series to annual periods and explain the aggregation.”
- “Compare two matched series and return observations, Pearson correlation, and calculation notes.”
- “Create a text sparkline and chart-ready points for these observations.”
- “Which Olano tool should answer: ‘How competitive was the latest COE bidding exercise?’”
- “List prompt categories, then show examples for rail and property.”
- “Show the compatibility record for `sg_cross_dataset`.”

## Prompts and resources

The aggregate server packages reusable MCP prompts:

- `research-singapore`
- `research-neighbourhood`
- `research-company`
- `analyze-property`
- `analyze-mobility`

It also exposes read-only resources at `singapore://about`, `singapore://sources`, and
`singapore://examples`. Tool-based discovery is available through `singapore_prompt_categories`,
`singapore_prompt_examples`, `singapore_prompt_for_tool`, and `singapore_ask`.

## Compatibility contract

Version 0.3.0 includes a machine-readable coverage registry for 87 stable `sg_*` compatibility
capabilities. Each record names an Olano tool and marks the implementation as:

- `native` — Olano implements the calculation or workflow directly;
- `delegated` — a focused Olano tool covers the capability through the named upstream source; or
- `constrained` — Olano exposes the safe, supportable building blocks and states what must be done
  explicitly instead of fabricating a result.

Use `singapore_capability_registry` to inspect the full mapping or
`singapore_capability_check` to inspect one capability. The contract is checked in CI. Compatibility
means coverage of the user need; it does not imply identical output, code, branding, or affiliation.

Olano extends the compatibility contract with OneMap routing and geocoding, live LTA DataMall tools, a dedicated
MRT/LRT package, stdio and Streamable HTTP, MCP prompts and resources, deterministic semantic
routing, explicit freshness/source metadata, bounded retrieval, period-aware cross-series analysis,
an optional persistent public-response cache, a standalone CLI, and packaged Agent Skills.

## Packaged Agent Skills

The repository includes eight reusable workflows for clients that support Agent Skills:

- `research-singapore` — general locations, mobility, economy, population, environment, and public
  services research;
- `analyze-singapore-property` — HDB/private-property evidence, neighbourhood, transport, amenities,
  and educational mortgage scenarios;
- `research-singapore-business` — ACRA/UEN lookup, business formations, sectors, labour, inflation,
  exchange rates, retail, tourism, and trade context;
- `analyze-singapore-mobility` — MRT/LRT, bus, road, parking, taxi, routing, and COE analysis;
- `analyze-singapore-economy` — period- and unit-aware economic indicator analysis;
- `research-singapore-civic` — weather, health, education, population, safety, and public services;
- `analyze-singapore-finance` — official rates and transparent mortgage and affordability scenarios;
  and
- `develop-with-singapore-mcp` — profile selection, exact tool calls, credentials, transports, and
  troubleshooting.

See [skills/README.md](skills/README.md) for installation and usage guidance.

## Credentials and caching

| Variable               | Purpose                                                                    |
| ---------------------- | -------------------------------------------------------------------------- |
| `DATA_GOV_SG_API_KEY`  | Optional data.gov.sg key for production use and provider limits            |
| `ONEMAP_TOKEN`         | OneMap bearer token for authenticated OneMap tools and rail address lookup |
| `LTA_DATAMALL_API_KEY` | LTA DataMall subscriber Account Key for dynamic transport APIs             |
| `OLANO_SG_CACHE_DIR`   | Optional absolute directory for the persistent public-response cache       |
| `OLANO_SG_PROFILE`     | Optional aggregate tool profile; defaults to `all`                         |

Every provider uses an in-memory TTL cache. Setting `OLANO_SG_CACHE_DIR` additionally persists
eligible public responses between processes. Cache entries use provider-specific TTLs and hashed
keys, are partitioned by a hash of the request-header identity, and omit the entire query string from
stored source metadata. Response payloads can still contain addresses, company searches, or other
request results. Do not share one cache directory across untrusted tenants; protect it as application
data and clear it when retention requirements demand it. `singapore_cache_info` reports whether it is
enabled.

## Official upstream sources and attribution

The suite keeps source agency, dataset/table identifier, source URL, retrieval time, observation
period, units, and freshness caveats wherever the upstream format allows it.

- [data.gov.sg developer guide](https://guide.data.gov.sg/developer-guide/api-overview) — Singapore
  public datasets published by their named agencies, including ACRA, HDB, URA, MOE, ECDA, IRAS,
  STB, EMA, SPF, MOH, and NEA datasets used by the curated catalog.
- [OneMap API documentation](https://www.onemap.gov.sg/apidocs/) — Singapore Land Authority address,
  geocoding, and routing services.
- [LTA DataMall](https://datamall.lta.gov.sg/content/datamall/en.html) — Land Transport Authority
  dynamic transport APIs and downloadable rail datasets.
- [SingStat Table Builder](https://tablebuilder.singstat.gov.sg/) — Singapore Department of
  Statistics economic, business, labour, trade, and population tables.
- [Meteorological Service Singapore](https://www.weather.gov.sg/) — official weather context; the
  implemented real-time feeds are retrieved through data.gov.sg.
- [Official bank interest rates dataset](https://data.gov.sg/datasets/d_5fe5a4bb4a1ecc4d8a56a095832e2b24/view)
  — SingStat-published series sourced from the Monetary Authority of Singapore, including SORA and
  published bank interest-rate statistics.
- [Singapore Open Data Licence](https://data.gov.sg/open-data-licence) — licence applying to covered
  data.gov.sg materials.

Rail tools additionally disclose the exact LTA snapshot date and source URL through
`rail_source_metadata`. API availability, data accuracy, rate limits, licences, and upstream terms
remain controlled by the respective providers. Applications must comply with those terms and retain
required attribution.

## Financial-data boundary

Olano integrates only the free official mortgage reference-rate dataset described above. It does
not expose live SGX quotes, lender product offers, or insurance premiums because no stable free
official API with suitable production and redistribution terms has been verified. It does not scrape
comparison sites or label third-party quote data as official Singapore data. Use
`finance_singapore_data_availability` for the current boundary and official reference links.

## Safety and engineering

The servers are read-only. Zod validates inputs; upstream origins and paths are fixed in code;
requests use timeouts, bounded response sizes, retries, rate spacing, and caching; and tools return
explicit errors for missing credentials. Derived tools disclose assumptions and do not turn area,
company, crime, property, or finance data into unsupported personal conclusions.

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run format:check
npm run lint
npm test
npm run build
```

Inspect the aggregate server interactively:

```bash
npx @modelcontextprotocol/inspector node packages/singapore/dist/cli.js
```

See [Architecture](docs/architecture.md), [Contributing](CONTRIBUTING.md), and
[Security](SECURITY.md).

## Licence

Source code is released under the MIT License. Government data remains subject to the licence and
terms published by each source agency.
