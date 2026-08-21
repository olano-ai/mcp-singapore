# awesome-mcp-servers — list pull request

**Where:** https://github.com/punkpeye/awesome-mcp-servers

**Mechanism:** fork, edit `README.md`, open a pull request.

**Status:** ready to file. Not yet filed — see "Why this was not filed automatically" below.

## Placement (resolved against `main` on 2026-08-21)

**Category:** `### 📊 Data Platforms` (anchor `data-platforms`).

This is where the directly comparable country-scoped government open-data suites already live:

- `alanpcf/brasil-data-mcp` — Brazilian public data
- `vinvuk/apiverket-mcp` — Swedish public data
- `vikramgorla/mcp-swiss` — 68 tools for Swiss open data
- `Hug0x0/mcp-reunion` — 96 tools for La Réunion open data

**Insert between these two existing entries**, which keeps the section's
case-insensitive alphabetical-by-owner ordering (`mbrummerstedt` < `olano-ai` < `Osseni94`):

- after `- [mbrummerstedt/powerbi-analyst-mcp](...)`
- before `- [Osseni94/keyneg-mcp](...)`

Use the neighbouring entries rather than a line number — the file changes daily. As of 2026-08-21
these sat at lines 1041 and 1042.

**Duplicate check:** performed on 2026-08-21. `olano-ai/mcp-singapore` is not listed anywhere in
the README. The only `olano` substring match is the unrelated `molanojustin/smithsonian-mcp`.

## Legend markers

`📇` TypeScript/JavaScript codebase, `☁️` Cloud Service. The README's own note defines cloud as
"MCP server is talking to remote APIs", which is what this server does.

No Glama badge is included. Most peer entries carry one, but the Olano Glama listing could not be
confirmed, and a badge pointing at a missing listing renders broken. Add one later if the listing
is verified.

## Line to add

```markdown
- [olano-ai/mcp-singapore](https://github.com/olano-ai/mcp-singapore) 📇 ☁️ - 291 tools for Singapore open data: mobility, property, business, economy, civic services, and finance. Powered by data.gov.sg, OneMap, LTA DataMall, and SingStat. All API keys optional. Install: `npx -y @olano/mcp-singapore`.
```

## Pull request title

```
Add Olano Singapore MCP server
```

## Pull request body

Adds the Olano Singapore MCP server under **Data Platforms**, alongside the existing country-scoped
open-data servers.

- Repository: https://github.com/olano-ai/mcp-singapore
- npm: `@olano/mcp-singapore`
- Official MCP Registry: `io.github.olano-ai/mcp-singapore@0.3.0`
- License: MIT

291 read-only tools, 5 prompts and 3 resources across seven selectable profiles, sourced from
data.gov.sg, OneMap, LTA DataMall and SingStat. All API credentials are optional.

Entry placed in alphabetical order within the category; links verified.

## Why this was not filed automatically

The release session's GitHub access is scoped to `olano-ai/mcp-singapore`. Both read and write
calls against `punkpeye/awesome-mcp-servers` are refused, and `add_repo` rejects cross-owner
attachments. Filing this requires either a session started with that repository as its source, or a
person forking and opening the pull request by hand. The placement above was resolved by reading
the raw README directly, so the remaining work is mechanical.

## Before filing

Re-read `CONTRIBUTING.md` and re-check the two neighbouring entries on the day you file. Categories
and ordering drift, and the maintainers ask that entries match the surrounding format exactly.
