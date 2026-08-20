# Codex and OpenAI plugins

Olano publishes one complete plugin and six focused plugins from this repository. Every repository
plugin includes Agent Skills and a local stdio MCP profile.

| Plugin                     | MCP profile | Packaged skills      |
| -------------------------- | ----------- | -------------------- |
| `olano-singapore`          | `all`       | All eight workflows  |
| `olano-singapore-property` | `property`  | Property and finance |
| `olano-singapore-mobility` | `mobility`  | Mobility             |
| `olano-singapore-business` | `business`  | Business             |
| `olano-singapore-economy`  | `economy`   | Economy              |
| `olano-singapore-civic`    | `civic`     | Civic                |
| `olano-singapore-finance`  | `finance`   | Finance              |

## Install from the Olano marketplace

Add the public GitHub repository as a Codex marketplace:

```bash
codex plugin marketplace add olano-ai/mcp-singapore
```

Open `/plugins`, select the Olano marketplace, and install the complete plugin or the smallest
focused plugin for the work. The complete plugin exposes the full MCP tool surface; focused plugins
reduce tool-definition overhead by starting one stable server-side profile.

The shortest cross-client installer remains the npm CLI:

```bash
npx -y @olano/sg-cli setup claude property
```

## Optional credentials

Codex MCP child processes inherit the current environment. Export only the values required by the
tools you use:

```bash
export DATA_GOV_SG_API_KEY="your-data-gov-key"
export ONEMAP_TOKEN="your-onemap-token"
export LTA_DATAMALL_API_KEY="your-lta-account-key"
```

The server starts without credentials. A tool that needs a missing value returns a structured
missing-credential error instead of fabricating a result.

## Public Plugins Directory

The focused Agent Skills are suitable for OpenAI's public Plugins Directory. The repository version
can launch a local stdio MCP server, but public OpenAI submissions cannot bundle a local stdio
server. Public submissions therefore contain the focused skills only. Users who need live Olano MCP
tools should install the repository marketplace or configure `@olano/mcp-singapore` separately.

An Olano-hosted public Streamable HTTP endpoint is intentionally not claimed. A future hosted MCP
submission must add production TLS, authentication, tenant isolation, request limits, monitoring,
and a privacy-policy update before review.

## Validation

```bash
npm run check:plugins
```

The repository check validates the OpenAI marketplace, plugin manifests, assets, policy URLs, exact
npm version and MCP profile arguments, and byte-identical copies of every canonical skill.
