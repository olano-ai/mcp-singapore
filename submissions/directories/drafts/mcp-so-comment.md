# mcp.so — intake comment

**Where:** https://github.com/chatmcp/mcpso/issues/1 (open intake thread; maintainers ask for
server links and list them on mcp.so)

**Mechanism:** a single comment on that issue. Free.

**Post as:** a GitHub account you control. This is a public comment on a third-party repository.

**Status:** ready to post. Not yet posted — the release session's GitHub access is scoped to
`olano-ai/mcp-singapore`, so calls against `chatmcp/mcpso` are refused and `add_repo` rejects
cross-owner attachments. Posting needs a session sourced from that repository, or a person pasting
the comment by hand.

**Thread verified open on 2026-08-21**, still collecting server links.

---

## Comment body

Olano Singapore MCP — open-source MCP servers and Agent Skills for Singapore public data:
mobility, property, business, the economy, civic services, and finance.

- Repository: https://github.com/olano-ai/mcp-singapore
- npm: `@olano/mcp-singapore` — https://www.npmjs.com/package/@olano/mcp-singapore
- Official MCP Registry: `io.github.olano-ai/mcp-singapore@0.3.0`
- License: MIT
- Transport: stdio and Streamable HTTP

291 read-only tools, 5 prompts, and 3 resources across seven selectable profiles (`all`,
`mobility`, `property`, `business`, `economy`, `civic`, `finance`). Data comes from data.gov.sg,
OneMap, LTA DataMall, and SingStat. All API credentials are optional.

Quick start:

```bash
npx -y @olano/mcp-singapore --profile all
```
