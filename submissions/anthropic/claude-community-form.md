# claude-community submission — prepared answers

Submit at **https://clau.de/plugin-directory-submission** (also reachable from claude.ai settings
and the Claude Console plugin submission page).

Pull requests opened directly against `anthropics/claude-plugins-community` are closed
automatically: that repository is a read-only nightly mirror of Anthropic's internal review
pipeline. The form is the only intake path, and it requires a signed-in Claude account, so this
step cannot be automated.

Approved plugins are installed by users with the `@claude-community` suffix, for example
`/plugin install olano-singapore@claude-community`.

> The field labels below are the information a plugin directory submission asks for. If the live
> form words a field differently, map the nearest answer across rather than re-deriving it.

## Shared answers — identical for all seven submissions

| Field                | Answer                                                                              |
| -------------------- | ----------------------------------------------------------------------------------- |
| Publisher / author   | Olano                                                                               |
| Website              | https://olano.ai                                                                    |
| Repository (public)  | https://github.com/olano-ai/mcp-singapore                                           |
| Marketplace manifest | https://github.com/olano-ai/mcp-singapore/blob/main/.claude-plugin/marketplace.json |
| License              | MIT                                                                                 |
| Version              | 0.3.0                                                                               |
| Support contact      | https://github.com/olano-ai/mcp-singapore/issues                                    |
| Security contact     | GitHub private vulnerability reporting on the repository                            |
| Privacy policy       | https://github.com/olano-ai/mcp-singapore/blob/main/PRIVACY.md                      |
| Terms of service     | https://github.com/olano-ai/mcp-singapore/blob/main/TERMS.md                        |

### Data handling (expect a question of this shape)

> The plugins run a local stdio MCP server via `npx`. There is no Olano account, no Olano
> analytics, and no usage telemetry. Requests go only to the Singapore public-data services the
> invoked tool needs — data.gov.sg, OneMap, LTA DataMall, and SingStat — and carry only the query
> parameters for that request. All three API credentials are optional, are read from environment
> variables or Claude Code user configuration, are declared `sensitive` in `plugin.json`, and are
> forwarded only to the matching upstream service. Responses are cached in memory; on-disk caching
> happens only when the user explicitly sets `OLANO_SG_CACHE_DIR`. The server never accepts
> arbitrary upstream URLs and reads no files outside its own package.

### Credentials declared as sensitive user configuration

- `data_gov_sg_api_key` — optional data.gov.sg API key, raises rate limits only
- `onemap_token` — optional OneMap token, needed for geocoding, routing, and address lookup
- `lta_datamall_api_key` — optional LTA DataMall account key, needed for live transport feeds

Every plugin works without credentials; missing credentials degrade coverage rather than fail.

## Per-plugin answers

Submit the aggregate first, then the six focused plugins. Each `source` below is the directory to
point the reviewer at.

### 1. olano-singapore

- **Name:** `olano-singapore`
- **Category:** Productivity
- **Source:** https://github.com/olano-ai/mcp-singapore/tree/main/plugins/olano-singapore
- **Short description:** The complete Singapore public-data MCP suite with eight focused Agent
  Skills and 291 read-only tools.
- **Long description:** Research Singapore across public government data in one plugin. Covers
  HDB and private property, MRT/LRT and bus mobility, ACRA company records, national economic
  indicators, weather and civic services, and official mortgage reference rates. Bundles eight
  Agent Skills, 5 prompts, and 3 resources. All tools are read-only and every credential is
  optional.
- **Why users want it:** One install gives Claude grounded, cited access to Singapore government
  data that it otherwise has to guess at.

### 2. olano-singapore-property

- **Name:** `olano-singapore-property`
- **Category:** Data & Analytics
- **Source:** https://github.com/olano-ai/mcp-singapore/tree/main/plugins/olano-singapore-property
- **Short description:** Singapore HDB resale, private-property, neighbourhood, and mortgage
  research — 63 tools and 2 Agent Skills.
- **Long description:** Query HDB resale transactions with real quartiles and medians, bound
  private-property evidence by project or district, add OneMap location and amenity context, and
  run transparent local mortgage calculations against official reference rates.

### 3. olano-singapore-mobility

- **Name:** `olano-singapore-mobility`
- **Category:** Productivity
- **Source:** https://github.com/olano-ai/mcp-singapore/tree/main/plugins/olano-singapore-mobility
- **Short description:** Singapore MRT, LRT, bus, road, parking, taxi, and COE research — 50 tools
  and 1 Agent Skill.
- **Long description:** Search station complexes, lines, codes, exits, and interchanges; find the
  nearest station to an address; read live bus arrivals, road traffic, carpark availability, and
  taxi positions from LTA DataMall; and follow COE bidding results over time.

### 4. olano-singapore-business

- **Name:** `olano-singapore-business`
- **Category:** Data & Analytics
- **Source:** https://github.com/olano-ai/mcp-singapore/tree/main/plugins/olano-singapore-business
- **Short description:** Singapore company, UEN, sector, retail, tourism, and trade research — 58
  tools and 1 Agent Skill.
- **Long description:** Search public ACRA entity records across 27 shards, resolve a UEN with
  explicit match uncertainty, compare monthly business formations and cessations by SSIC sector,
  and add retail, tourism, labour, and trade context from official series.

### 5. olano-singapore-economy

- **Name:** `olano-singapore-economy`
- **Category:** Data & Analytics
- **Source:** https://github.com/olano-ai/mcp-singapore/tree/main/plugins/olano-singapore-economy
- **Short description:** Singapore GDP, prices, employment, income, population, and trade analysis
  — 87 tools and 1 Agent Skill.
- **Long description:** Pull official SingStat series, align them by period, and produce
  transparent statistics, comparisons, correlations, and text sparklines. Period alignment and
  source dates are stated explicitly so results stay auditable.

### 6. olano-singapore-civic

- **Name:** `olano-singapore-civic`
- **Category:** Productivity
- **Source:** https://github.com/olano-ai/mcp-singapore/tree/main/plugins/olano-singapore-civic
- **Short description:** Singapore weather, air quality, health, education, childcare, and safety
  research — 73 tools and 1 Agent Skill.
- **Long description:** Read forecasts, temperature, rainfall, and PSI; follow dengue and disease
  reporting; and look up education, childcare, population, and public-service datasets published
  by Singapore agencies.

### 7. olano-singapore-finance

- **Name:** `olano-singapore-finance`
- **Category:** Data & Analytics
- **Source:** https://github.com/olano-ai/mcp-singapore/tree/main/plugins/olano-singapore-finance
- **Short description:** Singapore official rates, mortgage scenarios, FX, income, and inflation —
  55 tools and 1 Agent Skill.
- **Long description:** Read official mortgage reference-rate history, run local mortgage
  scenarios with the arithmetic shown rather than hidden, and set results against official
  exchange-rate, income, and inflation series.

## Pre-submission checklist

Run from a clean checkout on Node.js 22+ before filing:

```bash
npm ci && npm run build
npm run format:check && npm run lint && npx vitest run
npm run check:plugins
npm exec --yes --package='@anthropic-ai/claude-code@2.1.237' -- claude plugin validate .
for p in plugins/*; do
  npm exec --yes --package='@anthropic-ai/claude-code@2.1.237' -- claude plugin validate "$p"
done
```

Last verified for 0.3.0: root marketplace and all seven plugins pass, `check:plugins` reports 7
Claude Code plugins and 15 packaged skill copies.

## After submitting

Record the submission date and outcome per plugin in `../directories/mcp-directories.json` under a
`claude-community` entry. Leave the status as `submitted` until the listing is publicly visible in
`anthropics/claude-plugins-community`, then move it to `published` with the observed date.
