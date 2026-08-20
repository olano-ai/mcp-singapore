---
name: develop-with-singapore-mcp
description: Develop, integrate, and troubleshoot clients using the Olano Singapore MCP server and CLI. Use when choosing tool profiles, configuring stdio or Streamable HTTP, discovering tools and prompts, testing exact calls, setting credentials, or debugging an integration.
---

# Develop with Singapore MCP

1. Choose the smallest server profile: `all`, `mobility`, `property`, `business`, `economy`, `civic`, or `finance`. Use `singapore_tool_profiles` to inspect the active contract.
2. Start stdio with `npx -y @olano/mcp-singapore --profile <name>`. For local exploration, use `npx @olano/sg-cli list`, `search`, `examples`, `prompts`, `profile`, or `tool`.
3. Add only required secrets: `DATA_GOV_SG_API_KEY`, `ONEMAP_TOKEN`, and `LTA_DATAMALL_API_KEY`. Never commit credentials or silently replace a credentialed source with a different provider.
4. Discover a tool, inspect its input schema, then send exact JSON arguments. Prefer a domain-specific filtered or aggregate tool over generic dataset downloads.
5. For HDB filtered rows or statistics, use `hdb_resale_stats`; use `hdb_resale_search` for explicit raw pagination. Respect returned completeness, truncation, freshness, and source fields.
6. When debugging, capture the client, transport, package version, profile, tool name, sanitized arguments, structured error, and server stderr. Do not put protocol output on stdio stdout.

Use Streamable HTTP when a shared deployment is required and apply authentication, rate limits, and network controls appropriate to that deployment.
