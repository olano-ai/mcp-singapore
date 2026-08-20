# OpenAI submission materials

`focused-plugins.json` contains the review metadata, starter prompts, and positive and negative test
cases for the six focused skills-only submissions.

Repository-installed Codex plugins include `.codex-mcp.json` and launch a local npm MCP server.
Public-directory upload bundles must omit that local stdio configuration and contain only the
focused skill directories and submission metadata. The canonical skills remain under `skills/*`;
the copies under `plugins/*/skills/*` are validated as byte-identical in CI.
