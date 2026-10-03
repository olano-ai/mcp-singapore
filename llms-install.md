# Installing Olano Singapore MCP (instructions for AI agents such as Cline)

Singapore MCP is a local stdio MCP server published on npm as `@olano/mcp-singapore`. Nothing needs
to be cloned, built or installed globally: `npx` downloads and runs it.

## 1. Check the prerequisite

Node.js 20 or newer must be installed. Run:

```bash
node --version
```

If the output is lower than `v20`, or the command is not found, ask the user to install the LTS
release from https://nodejs.org/ and stop until they have.

## 2. Add the server to the MCP settings

Add one entry named `singapore` to the client's MCP settings file (for Cline:
`cline_mcp_settings.json`), keeping every existing server and keeping the JSON valid:

```json
{
  "mcpServers": {
    "singapore": {
      "command": "npx",
      "args": ["-y", "@olano/mcp-singapore"]
    }
  }
}
```

On Windows, if `npx` cannot be started directly, use `"command": "cmd"` with
`"args": ["/c", "npx", "-y", "@olano/mcp-singapore"]`.

Do not add API keys unless the user provides them. The server works without any.

## 3. Optional: API keys

Three optional environment variables raise rate limits or unlock live feeds. Add them under an
`"env"` object in the same entry only if the user supplies them:

| Variable               | What it unlocks                                                   |
| ---------------------- | ----------------------------------------------------------------- |
| `DATA_GOV_SG_API_KEY`  | Higher data.gov.sg rate limits (useful for ACRA company searches) |
| `ONEMAP_TOKEN`         | Address search, geocoding and routing                             |
| `LTA_DATAMALL_API_KEY` | Live bus arrivals, traffic, carpark and taxi feeds                |

Missing keys reduce coverage; they never make the server fail to start.

## 4. Optional: a smaller tool set

The full server registers 291 read-only tools. To send fewer tool definitions to the model, append
a profile to `args`, for example `["-y", "@olano/mcp-singapore", "--profile", "property"]`.
Profiles: `all`, `mobility`, `property`, `business`, `economy`, `civic`, `finance`.

## 5. Verify

Restart the MCP connection, then call a keyless tool, for example ask:
"What are the MRT/LRT codes and line connections for Paya Lebar?"
A correct install returns station codes with the source dataset and its date.

If the server does not appear, check that Node.js and npm can reach the package by running the same
tool from a terminal with the companion CLI:

```bash
npx -y @olano/sg-cli tool rail_search_stations '{"query":"Paya Lebar"}'
```

It should print Paya Lebar with codes `CC9` and `EW8`. If it does, the package works and the problem
is in the MCP settings file (usually invalid JSON or a missing comma between entries).
