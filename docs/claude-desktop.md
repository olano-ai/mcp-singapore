# Claude Desktop

This page covers the **Chat** tab of the Claude Desktop app. For the **Code** tab and the `claude`
terminal command, see [Claude Code plugins](claude-code.md), which also installs the eight packaged
Agent Skills.

For a step-by-step first install, see [Claude Desktop app](../README.md#claude-desktop-app) in the
README. This page is the reference.

## The bundle

Singapore MCP ships as an **MCP Bundle** (`.mcpb`), the single-file extension format Claude Desktop
installs in one click. The bundle is self-contained: it carries the aggregate server, all eleven
Olano packages, and every third-party dependency. Claude Desktop runs it with its own built-in
Node.js runtime, so the user does not install Node.js, edit `claude_desktop_config.json`, or wait
for an `npx` download.

Download the latest bundle:

```text
https://github.com/olano-ai/mcp-singapore/releases/latest/download/olano-singapore.mcpb
```

Every release also carries a version-stamped copy, `olano-singapore-<version>.mcpb`.

Install it by double-clicking the file, dragging it onto the Claude Desktop **Settings** window, or
choosing **Settings → Extensions → Advanced settings → Install Extension…**. All three open the same
review dialog, which lists the tools and the optional settings before anything is enabled.

Bundles are not signed. Claude Desktop reports the bundle as unsigned during install; that is
expected for this project today.

## Optional settings

The install dialog exposes four optional settings. All four may be left empty: the server starts
without any of them, and only the tools that need a credential return an explicit
missing-credential error.

| Setting                  | Environment variable   | Needed by                                                   |
| ------------------------ | ---------------------- | ----------------------------------------------------------- |
| data.gov.sg API key      | `DATA_GOV_SG_API_KEY`  | Nothing; it raises data.gov.sg provider limits              |
| OneMap token             | `ONEMAP_TOKEN`         | Address search, reverse geocoding, routing, rail-by-address |
| LTA DataMall account key | `LTA_DATAMALL_API_KEY` | Live bus arrivals, traffic, carpark, and taxi tools         |
| Response cache folder    | `OLANO_SG_CACHE_DIR`   | Nothing; it persists eligible public responses between runs |

Credentials are declared `sensitive`, so Claude Desktop masks them and stores them in the operating
system keychain rather than in a configuration file. Read
[Credentials and caching](../README.md#credentials-and-caching) before setting a cache folder.

The bundle always loads the complete `all` tool profile. Focused profiles are available through the
[Claude Code plugins](claude-code.md) and the `--profile` flag on the npm package.

## Configuration file alternative

Claude Desktop still reads `claude_desktop_config.json`, and the npm package works there. That route
requires Node.js 20 or newer on the user's `PATH`, because Claude Desktop's built-in runtime is only
used for installed extensions. See Route C under
[Claude Desktop app](../README.md#claude-desktop-app) in the README and
[`examples/claude-desktop.json`](../examples/claude-desktop.json).

Prefer the bundle. The configuration file is the right choice only when pinning a profile, pointing
at an unpublished build, or running the server over Streamable HTTP.

## Build the bundle

```bash
npm ci
npm run build
npm run build:mcpb
npm run check:mcpb
```

`build:mcpb` writes `build/olano-singapore-<version>.mcpb`. It walks the dependency graph from
`@olano/mcp-singapore`, installs the third-party dependencies at the exact versions the monorepo
resolved, copies each Olano package's compiled `dist`, renders `icon.png` from the plugin's SVG
mark, and generates `manifest.json` with the live tool inventory read from the built server.

`check:mcpb` unpacks the packed bundle outside the repository and starts it with the exact command,
arguments, and environment its own manifest declares, with every optional credential left blank. It
asserts the MCP handshake, that the served tool list matches the manifest, that a bundled-data tool
answers, and that a credentialed tool returns a missing-credential error instead of crashing. A
dependency that only resolves through the monorepo's `node_modules` fails there rather than on a
user's machine.

CI builds and verifies the bundle on every pull request. Tagged releases attach it to the GitHub
release after the npm publish succeeds.

The manifest targets MCPB manifest version `0.3`, the current `latest` schema shipped by
[`@anthropic-ai/mcpb`](https://github.com/modelcontextprotocol/mcpb). See the
[MCPB build guide](https://claude.com/docs/connectors/building/mcpb) for the format itself.
