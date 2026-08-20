# `@olano/mcp-singapore`

The complete Olano Singapore MCP server: public-data providers, curated datasets, ACRA and SingStat,
MRT/LRT, mortgage reference rates, deterministic analytics and insights, cross-agency workflows,
prompts, and resources behind one endpoint.

> This is an independent community project maintained by Olano. It is not affiliated with,
> endorsed by, or an official product of the Singapore Government or any government agency.

## Run over stdio

```bash
npx -y @olano/mcp-singapore
```

The default `all` profile preserves the complete aggregate server. For a smaller model context,
select one of the production server-side profiles:

```bash
npx -y @olano/mcp-singapore --profile mobility
OLANO_SG_PROFILE=property npx -y @olano/mcp-singapore
```

Available profiles are `mobility`, `property`, `business`, `economy`, `civic`, and `finance`.
Unknown names fail at startup with the supported-name list. Profiles use stable, exported tool-prefix
contracts; they keep every MCP prompt and resource, plus the always-available
`singapore_tool_profiles` discovery tool. Call that tool to inspect exact live counts and optionally
list every tool in a profile.

Example client configuration:

```json
{
  "mcpServers": {
    "singapore": {
      "command": "npx",
      "args": ["-y", "@olano/mcp-singapore", "--profile", "property"],
      "env": {
        "ONEMAP_TOKEN": "your-onemap-token",
        "LTA_DATAMALL_API_KEY": "your-lta-account-key"
      }
    }
  }
}
```

Credentials are optional at server startup. Tools that require a missing credential return an
explicit error.

## Run over Streamable HTTP

```bash
npx -y @olano/mcp-singapore --transport http --host 127.0.0.1 --port 3000
```

`--profile <name>` works with both stdio and Streamable HTTP and can appear alongside the transport
options.

Connect to `http://127.0.0.1:3000/mcp`. Add authentication, TLS, and request limits before exposing
the listener beyond a local or trusted network.

## Included capabilities

- data.gov.sg catalog, metadata, rows, and real-time feeds;
- SLA OneMap address search, reverse geocoding, and routing;
- LTA DataMall buses, traffic, parking, and taxis;
- weather forecasts, temperature, rainfall, and PSI;
- curated ACRA, HDB, URA, MOE, ECDA, economy, labour, population, health, energy, crime, hawker, and
  tourism datasets;
- SingStat business, household, wages, population, family, labour, and trade tables;
- offline-first MRT/LRT station, line, code, exit, interchange, and proximity queries;
- official SORA/bank reference-rate history and educational mortgage calculations;
- HDB, COE, CPI, retail-sales, employment, and business-formation derived insights;
- period-aware series alignment, comparison, correlation, visualisation, and local statistics; and
- company, property-area, location, and market-context workflows.

Use the companion CLI to inspect the current inventory:

```bash
npx -y @olano/sg-cli list
npx -y @olano/sg-cli search mortgage
npx -y @olano/sg-cli examples rail
npx -y @olano/sg-cli prompts
```

## Prompts and resources

Packaged prompts:

- `research-singapore`
- `research-neighbourhood`
- `research-company`
- `analyze-property`
- `analyze-mobility`

Packaged resources:

- `singapore://about`
- `singapore://sources`
- `singapore://examples`

Prompt-discovery tools include `singapore_prompt_categories`, `singapore_prompt_examples`,
`singapore_prompt_for_tool`, and the deterministic `singapore_ask` router.

## Credentials and cache

| Variable               | Used by                                                 |
| ---------------------- | ------------------------------------------------------- |
| `DATA_GOV_SG_API_KEY`  | Optional data.gov.sg production access                  |
| `ONEMAP_TOKEN`         | OneMap tools and rail address lookup                    |
| `LTA_DATAMALL_API_KEY` | LTA dynamic transport tools                             |
| `OLANO_SG_CACHE_DIR`   | Optional persistent cache for eligible public responses |
| `OLANO_SG_PROFILE`     | Optional aggregate tool profile; defaults to `all`      |

In-memory caching is always used. The optional disk cache uses provider TTLs and hashed keys and
omits all query strings from stored metadata. Cached response payloads can still contain request
results, so do not share a cache directory across untrusted tenants. Run `singapore_cache_info` to
inspect its status.

## Compatibility

The aggregate includes a machine-readable coverage contract for all 87 capabilities in
`@altronis/sgdata-mcp@0.5.3`. `singapore_capability_registry` returns the full native, delegated, and
constrained mapping; `singapore_capability_check` looks up one record. The mapping is validated in
CI and does not imply identical implementation, output, branding, or affiliation.

## Data boundaries

Tools preserve source and freshness information wherever available. Rail is based on dated official
snapshots rather than live service status. Finance integrates a free official mortgage reference-rate
dataset, not live lender offers. There is no live SGX or insurance feed because no stable free
official API with suitable production and redistribution terms has been verified.

See the repository [README](https://github.com/olano-ai/mcp-singapore#readme) for categorized example
questions, exact official-source attribution, Agent Skills, and development instructions.
