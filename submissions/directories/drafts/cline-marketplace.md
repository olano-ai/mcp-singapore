# Cline MCP Marketplace — submission issue

**Where:** https://github.com/cline/mcp-marketplace/issues/new (title prefix `[Server Submission]:`)

**Mechanism:** a new issue. Maintainers aim to review within a few days.

**Blocking prerequisite:** the submission requires a **400×400 PNG logo**. The repository currently
ships `plugins/*/assets/olano-singapore.svg` only, so a PNG has to be exported and hosted at a
stable URL before filing. Do not submit without it.

**Also worth adding first:** Cline asks submitters to confirm they handed Cline only the
`README.md` (or an `llms-install.md`) and watched it set the server up successfully. Adding an
`llms-install.md` at the repository root reduces the chance of a setup-failure rejection.

---

## Issue body

**GitHub Repo URL:** https://github.com/olano-ai/mcp-singapore

**Logo:** 400×400 PNG — attach the exported Olano Singapore mark.

**Reason for addition:**

Olano Singapore MCP gives Cline users grounded access to Singapore government data instead of
guessed answers. It exposes 291 read-only tools, 5 prompts, and 3 resources over seven selectable
profiles, sourced from data.gov.sg, OneMap, LTA DataMall, and SingStat.

Typical uses: HDB resale statistics with real medians and quartiles, MRT/LRT station and route
lookup, live bus arrivals and carpark availability, public ACRA company and UEN records, official
economic series with period-aligned comparisons, and weather and air-quality readings.

Installation is a single stdio command with no account and no required credentials:

```bash
npx -y @olano/mcp-singapore --profile all
```

Three optional API keys (`DATA_GOV_SG_API_KEY`, `ONEMAP_TOKEN`, `LTA_DATAMALL_API_KEY`) raise rate
limits and unlock live transport and geocoding. Missing credentials degrade coverage rather than
fail. MIT licensed, published on npm and in the official MCP Registry as
`io.github.olano-ai/mcp-singapore@0.3.0`.

**Installation testing:** confirm this only after actually running the flow — hand Cline the
`README.md` and let it configure the server end to end.
