# MCP directory submissions

`mcp-directories.json` is the canonical listing copy and status record for external MCP
directories. `statusLegend` in that file defines every status value, and each entry carries either
the evidence behind a `published` claim or the blocker preventing submission. Public documentation
must never describe a `prepared` entry as a live listing.

`drafts/` holds ready-to-post copy for the destinations that take a GitHub comment or pull request.
Each draft states where it goes, the mechanism, and any prerequisite. Read the destination's own
contributing rules on the day you file — categories, templates, and required fields drift.

## Current picture

The Official MCP Registry and npm are the two machine-readable publications, and both are automated
by the release tag workflow. PulseMCP ingests from the Registry, so it needs no action.

Everything else is a human submission:

- **mcp.so** and **awesome-mcp-servers** are ready to file now.
- **Docker MCP Catalog** is ready but is the most involved, needing a generated `server.yaml` and a
  container review.
- **Cline** is blocked on a 400×400 PNG logo, which the repository does not yet ship.
- **Smithery** is blocked until the project exposes a public HTTPS MCP endpoint or builds an MCPB
  artifact. The server already speaks Streamable HTTP, so this is a hosting and packaging decision
  rather than a code gap.
- **Glama** was previously recorded as indexed. That could not be confirmed from the release
  environment, so it is marked `unverified` pending a check from a normal browser.

Anthropic's `claude-community` directory is tracked here for completeness, but its copy lives in
`../anthropic/claude-community-form.md`.
