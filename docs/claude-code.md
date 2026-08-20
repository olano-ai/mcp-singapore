# Claude Code plugins

The repository is an installable Claude Code marketplace named `olano`. Each plugin bundles a
server-side tool profile and the Agent Skills that teach Claude when and how to use it. Claude Code
starts the bundled MCP server automatically when the plugin is enabled.

## Install

Inside Claude Code, add the GitHub marketplace once:

```text
/plugin marketplace add olano-ai/mcp-singapore
```

Install one plugin. A focused plugin is recommended because it sends fewer tool definitions to the
model:

```text
/plugin install olano-singapore-property@olano
```

Or use the Olano CLI outside an interactive Claude session:

```bash
npx -y @olano/sg-cli setup claude property
npx -y @olano/sg-cli doctor claude property
```

Use `--dry-run` with `setup claude` to print the exact non-interactive operations without changing
Claude Code configuration.

## Available plugins

| Plugin                     | MCP profile | Packaged skills                                              |
| -------------------------- | ----------- | ------------------------------------------------------------ |
| `olano-singapore`          | `all`       | All eight Singapore research, analysis, and developer skills |
| `olano-singapore-property` | `property`  | Property and finance                                         |
| `olano-singapore-mobility` | `mobility`  | MRT/LRT, buses, roads, parking, taxis, and COE               |
| `olano-singapore-business` | `business`  | Companies, UENs, sectors, and business context               |
| `olano-singapore-economy`  | `economy`   | Economic indicators and matched-period analysis              |
| `olano-singapore-civic`    | `civic`     | Weather, health, education, population, and public services  |
| `olano-singapore-finance`  | `finance`   | Official rates, mortgages, FX, income, and inflation         |

The focused plugins still include shared catalog, prompt-discovery, cache, and analytics tools. The
server's `singapore_tool_profiles` tool returns the exact active contract.

## Optional credentials

When a plugin is enabled, Claude Code can prompt for the optional credentials used by that profile:

- data.gov.sg API key;
- OneMap token; and
- LTA DataMall account key.

They are declared as sensitive plugin configuration and are substituted into the MCP process at
runtime. Do not place real values in `.mcp.json`, a project file, or a prompt. The server starts
without credentials and returns explicit errors only for operations that need them.

## Update and validate

Refresh the marketplace after an Olano release:

```text
/plugin marketplace update olano
```

Repository maintainers validate the complete marketplace with:

```bash
claude plugin validate .
npm run check:plugins
```

The repository check also verifies that plugin and npm versions match, every MCP command selects the
intended profile, and every packaged skill is byte-for-byte equal to its canonical source.

See the official Claude Code documentation for [plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces),
[plugin components and user configuration](https://code.claude.com/docs/en/plugins-reference), and
[installing plugins](https://code.claude.com/docs/en/discover-plugins).
