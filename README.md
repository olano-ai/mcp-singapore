<p align="center">
  <img src="assets/olano-lockup.svg" alt="olano.ai — Singapore MCP" width="460">
</p>

<h1 align="center">🇸🇬 Singapore MCP by Olano</h1>

[![npm](https://img.shields.io/npm/v/%40olano%2Fmcp-singapore?logo=npm&label=npm&color=2563eb)](https://www.npmjs.com/package/@olano/mcp-singapore)
[![CI](https://github.com/olano-ai/mcp-singapore/actions/workflows/ci.yml/badge.svg)](https://github.com/olano-ai/mcp-singapore/actions/workflows/ci.yml)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-published-16a34a)](https://registry.modelcontextprotocol.io/)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Ask Claude or Codex questions about Singapore property, MRT/LRT, buses, companies, weather, the
economy, public services, and official financial reference data.

**291 read-only tools · 8 Agent Skills · 7 plugins · stdio and Streamable HTTP**

Built and maintained in Singapore by Olano — the [olano.ai](https://olano.ai) platform for applied
AI, and [olano.sg](https://olano.sg), our Singapore AI studio. Singapore MCP is the studio's open
contribution to the local AI community, and it is free to use under the MIT licence.

> Singapore MCP is an independent community project. It is not affiliated with, endorsed by, or an
> official product of the Singapore Government or any government agency. “Official” below describes
> an upstream data source, not this software.

## Overview

Singapore MCP is a read-only bridge between an AI client and Singapore's official public data:
data.gov.sg, OneMap, LTA DataMall, and SingStat. Every answer keeps its source agency, dataset
identifier, observation period, units, and freshness caveats, so you can check the work. Most of it
runs with no API key at all.

The monorepo separates provider access, reusable analysis, and user-facing workflows. Install the
aggregate server for the complete experience or a focused executable when you only need one
provider.

| Package                  | Role                                                                                                                      | Credentials                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `@olano/mcp-singapore`   | Aggregate server: every provider, catalog, insight, rail, finance, analytics, prompt, resource, and cross-agency workflow | Depends on the selected tool          |
| `@olano/mcp-datagov`     | data.gov.sg catalog, metadata, rows, and real-time feeds                                                                  | Optional data.gov.sg key              |
| `@olano/mcp-onemap`      | OneMap address search, reverse geocoding, and routing                                                                     | OneMap token                          |
| `@olano/mcp-lta`         | LTA DataMall bus arrivals, traffic, parking, and taxi feeds                                                               | LTA DataMall Account Key              |
| `@olano/mcp-weather`     | Forecasts, temperature, rainfall, and PSI                                                                                 | Optional data.gov.sg key              |
| `@olano/mcp-catalog`     | Curated Singapore datasets, 27 ACRA entity shards, and SingStat tables                                                    | Optional data.gov.sg key              |
| `@olano/mcp-insights-sg` | Prompt discovery, semantic routing, period-aware comparisons, and derived public-data insights                            | Depends on the routed source          |
| `@olano/mcp-rail-sg`     | MRT/LRT stations, codes, lines, exits, interchanges, and nearest-location tools                                           | None; OneMap token for address lookup |
| `@olano/mcp-finance-sg`  | Official mortgage reference-rate history and transparent local mortgage calculations                                      | Optional data.gov.sg key              |
| `@olano/mcp-analytics`   | Deterministic local statistics, comparisons, correlations, and text sparklines                                            | None                                  |
| `@olano/mcp-core`        | Shared transport, safe HTTP client, caching, retries, and MCP result helpers                                              | None                                  |
| `@olano/sg-cli`          | Search, inspect, route, and invoke the complete suite from a terminal                                                     | Depends on the selected tool          |

Focused stdio/HTTP executables are available for the aggregate, data.gov.sg, OneMap, LTA, weather,
and rail packages. The other packages are reusable registration libraries composed by the aggregate
server.

## Example questions

Ask these in an MCP client, or use `olano-sg examples [category]` to browse the packaged prompt
catalog. Results depend on upstream coverage and, for a few tools, on the optional keys in
[Credentials and caching](#credentials-and-caching). Not installed yet? Start with
[Quick start](#quick-start).

### Companies and ACRA

- “Find the official public ACRA records matching `Olano` and show the UEN and entity status.”
- “Look up this exact UEN across all ACRA shards; make any match uncertainty explicit.”
- “Compare monthly business formations and cessations, then calculate net formations.”
- “How have formations changed for two SSIC sectors over matched periods?”

### HDB and private property

- “Show recent 4-room HDB resale transactions in Bedok and calculate the median and quartiles.”
- “Compare HDB resale price per square metre between Tampines and Jurong East.”
- “Find HDB carparks whose address contains `Bishan` and group them by carpark type.”
- “Show bounded private-property transaction evidence for a project or district.”
- “Build a property-area brief for Queenstown with OneMap location context.”

The first example is a single MCP operation. `hdb_resale_stats` applies the exact town and flat-type
filters, selects the latest available matching month by default, returns the transaction rows, and
calculates the range, median, Q1, Q3, and price per square metre inside the server:

```bash
npx -y @olano/sg-cli tool hdb_resale_stats '{"town":"BEDOK","flatType":"4 ROOM"}'
```

Use `latestMonths`, `startMonth`, or `endMonth` to choose a different period. A direct dataset
download is not required. This operation is available in the aggregate server's `all` and
`property` profiles; it is not part of the focused `@olano/mcp-datagov` row-reader package.

### COE, buses, roads, parking, and taxis

- “What is the latest Category B COE premium, quota, number of bids, and bid-to-quota ratio?”
- “Show the last 12 Category A bidding exercises and changes from the prior premium.”
- “When are the next buses arriving at this bus stop?”
- “List current traffic incidents and nearby traffic-camera images.”
- “Show live LTA carpark availability and taxi availability.”

### MRT and LRT

- “What are the MRT/LRT codes and line connections for Paya Lebar?”
- “List every station on the Thomson-East Coast Line.”
- “Which official station exits belong to City Hall?”
- “Find the five nearest rail stations to latitude 1.29027, longitude 103.851959.”
- “Find rail stations near `1 Fullerton Road` and state whether distance is straight-line or walking.”
- “List MRT/LRT interchanges and show the date of each bundled source snapshot.”

### Weather, PSI, rainfall, and dengue

- “Show the current two-hour forecast for Singapore areas.”
- “What are the latest temperature and rainfall readings by station?”
- “Show the 24-hour forecast, four-day outlook, and latest PSI readings.”
- “Find current dengue-cluster records and include the dataset freshness.”

### Education and childcare

- “Find MOE schools matching `Nanyang` and show the official dataset fields.”
- “Find ECDA childcare centres in an area and summarise any published vacancy fields.”
- “Resolve this address with OneMap before comparing nearby school or childcare records.”

### GDP, prices, labour, income, FX, tax, and trade

- “Show the latest GDP growth observations and compare selected industries.”
- “Calculate year-on-year CPI change using the same month, not adjacent months.”
- “Compare retail-sales year-on-year change with CPI over matched monthly periods.”
- “Show median-income history, employment by sector, and calculated employment growth.”
- “Show unemployment and resident labour-force participation history.”
- “Find official MAS exchange-rate observations and preserve each published unit.”
- “Show IRAS tax-collection history and calculate category shares only where units match.”
- “Show Singapore merchandise-trade history from SingStat.”

### Tourism, population, health, energy, crime, and hawkers

- “Rank visitor-arrival source markets for the latest published period.”
- “Show tourism receipts history and warn me if the curated dataset is stale.”
- “Compare population, live births, deaths, marriages, and divorces over available periods.”
- “Show disease-case history, its last observation, and a clear frozen-data warning if applicable.”
- “Show electricity-generation history and the source agency.”
- “Compare like-for-like recorded-crime series without inferring neighbourhood or individual risk.”
- “Find NEA hawker centres matching `Maxwell` and profile the published fields.”

### Mortgage reference rates

- “Show the latest official SORA and published housing-loan reference-rate series.”
- “Show 24 months of official mortgage reference-rate context and identify the latest period.”
- “At a user-supplied illustrative rate, calculate the monthly payment on a S$600,000 mortgage.”
- “Stress-test that mortgage at 2.5%, 3.5%, and 4.5%, with assumptions shown.”

These are official reference-rate statistics and educational calculations, not live lender offers,
credit decisions, or personal financial advice.

### Cross-series analysis and discovery

- “Align these quarterly GDP and monthly CPI series to annual periods and explain the aggregation.”
- “Compare two matched series and return observations, Pearson correlation, and calculation notes.”
- “Create a text sparkline and chart-ready points for these observations.”
- “Which Olano tool should answer: ‘How competitive was the latest COE bidding exercise?’”
- “List prompt categories, then show examples for rail and property.”
- “Show the compatibility record for `sg_cross_dataset`.”

### Advanced: multi-step and cross-agency questions

These are where the eight packaged Agent Skills and the analytics tools earn their keep. Each one
spans several agencies or several periods, so the answer has to align units, match periods, and keep
every source attached. Ask them in a client that has the Agent Skills installed — the
[Claude Code plugin](#claude-code) or the [Claude Desktop extension](#claude-desktop-app) — and
Claude will chain the tools itself.

**Property and affordability**

- “Build a Queenstown property brief: recent 4-room resale medians and quartiles, the nearest MRT
  stations with walking versus straight-line distance stated, nearby schools and childcare, and an
  illustrative mortgage at 3.5% on the median price. Show every assumption and source.”
- “Compare HDB resale price per square metre across Tampines, Bedok, and Jurong East over matched
  months, then test whether the ranking survives switching to a different flat type.”
- “Stress-test a S$600,000 mortgage at 2.5%, 3.5%, and 4.5% against the latest published SORA and
  housing-loan reference rates, and say plainly which parts are official statistics and which are my
  own illustrative assumptions.”

**Economy and cross-series analysis**

- “Align quarterly GDP with monthly CPI to annual periods, explain the aggregation you used, then
  report the Pearson correlation with its calculation notes and any period you had to drop.”
- “Compare retail sales year-on-year against CPI year-on-year over exactly matched months, and flag
  any month where the two series use different bases or units.”
- “Track median income, employment by sector, and resident labour-force participation over the
  longest matched window available, and calculate employment growth per sector.”

**Business and sector research**

- “Profile the ACRA records matching a company name, resolve the UEN across all 27 shards, make any
  match uncertainty explicit, then put it in context with formations and cessations for its SSIC
  sector over matched periods.”
- “Compare net business formations across two SSIC sectors, then check whether the pattern lines up
  with retail sales and visitor arrivals for the same periods.”

**Mobility and location**

- “Plan a comparison of three addresses for a new office: resolve each with OneMap, list rail
  stations within walking distance, show live carpark availability nearby, and summarise the
  trade-offs without inferring anything the data does not support.”
- “Show the last 12 Category A and Category B COE bidding exercises with premium changes, quota,
  bids, and bid-to-quota ratio, and say which exercises were most competitive and why.”

**Data quality and method**

- “Answer using only tools that disclose their source agency and observation period, and list any
  part of my question you could not answer within that constraint.”
- “Show me which Olano tool you would use for this question and why, before you run it.”
- “Repeat that analysis, but this time show the freshness of every dataset you touched and warn me
  about any that is stale or frozen.”

## Quick start

New to MCP? An MCP server is a small helper program that your AI app runs on your own computer so
it can look things up for you. You install it once, and after that you just ask questions in plain
English. This one runs locally and reads official Singapore public data; it has no Olano account,
telemetry, or analytics. See [Privacy](PRIVACY.md).

**Find your app in the table and follow only that section.** The default install gives you the
**complete Olano Singapore suite**. You do not need to pick a category, and you do not need an API
key.

| Your app                                       | Follow this                               | How                         |
| ---------------------------------------------- | ----------------------------------------- | --------------------------- |
| **Claude Desktop app** — the **Chat** tab      | [Claude Desktop app](#claude-desktop-app) | Download one file, click it |
| **Claude Code** — terminal or the **Code** tab | [Claude Code](#claude-code)               | Two `/plugin` commands      |
| **Codex app**                                  | [Codex app](#codex-app)                   | Add a server in Settings    |
| **Codex CLI**                                  | [Codex CLI](#codex-cli)                   | One `codex mcp add` command |

Not sure which one you have? If you type questions into a chat window, you are using the Claude
Desktop app. If you run `claude` in a terminal, or you use the **Code** tab inside the desktop app,
you are using Claude Code. Claude Code gets the better install, because it can load the Agent Skills
as well as the tools.

### Before you start

**Installing the Claude Desktop extension? Nothing to install first.** Claude Desktop ships its own
Node.js runtime and the extension carries everything else. Skip straight to
[Claude Desktop app](#claude-desktop-app).

**Every other route** runs the server with `npx`, which comes with Node.js. You need **Node.js 20 or
newer**.

1. Download the **LTS** installer from [nodejs.org](https://nodejs.org/) and run it.

2. Open a terminal — Terminal on macOS, PowerShell on Windows — and check the version:

   ```bash
   node --version
   ```

You should see `v20.` or higher, for example `v22.14.0`. If you get "command not found" or "not
recognized", close the terminal, open a new one, and try again. If it still fails, Node.js did not
install correctly.

You do **not** need to download this repository, clone anything, or run `npm install`. `npx` fetches
the published package for you the first time it runs.

### Claude Desktop app

> This section is for the **Chat** tab of the Claude Desktop app. If you use the **Code** tab,
> follow [Claude Code](#claude-code) instead — you get the eight Agent Skills there too.

#### Route A — install the extension (recommended)

One file, one click, no terminal and no Node.js.

1. **Download the extension.**

   [**⬇ Download olano-singapore.mcpb**](https://github.com/olano-ai/mcp-singapore/releases/latest/download/olano-singapore.mcpb)

   It is about 2 MB and contains the whole server. Every published version is also listed on the
   [releases page](https://github.com/olano-ai/mcp-singapore/releases).

2. **Install it.** Double-click the downloaded file. Claude Desktop opens a review dialog showing
   what the extension adds. Select **Install**.

   If double-clicking does nothing, open Claude Desktop and drag the file onto the **Settings**
   window, or go to **Settings → Extensions → Advanced settings → Install Extension…** and pick it.

   Claude Desktop will note that the extension is not signed. That is expected for this project.

3. **Leave every setting blank and finish.** The four optional boxes are for free government API
   keys you probably do not have yet. Everything works without them, and you can add them later from
   **Settings → Extensions**.

4. **Ask a question.** No restart needed.

   > Show me the latest two-hour weather forecast for Singapore, with timestamps.

That is it, can already. To update later, download the file again and install it over the top.

#### Route B — let an AI agent set it up for you

Already have Claude Code, Codex, Cursor, or another coding agent that can edit files on your
computer? Paste this and it will do the whole job:

```text
Please add the Olano Singapore MCP server to my Claude Desktop configuration.

1. Open my Claude Desktop config file, creating it if it does not exist:
   - macOS:   ~/Library/Application Support/Claude/claude_desktop_config.json
   - Windows: %APPDATA%\Claude\claude_desktop_config.json
   - Linux:   ~/.config/Claude/claude_desktop_config.json
2. Inside the "mcpServers" object, add an entry named "singapore" that runs the
   command "npx" with the arguments ["-y", "@olano/mcp-singapore"]. On Windows use
   the command "cmd" with ["/c", "npx", "-y", "@olano/mcp-singapore"] instead.
3. Keep every server that is already in the file and keep the JSON valid.
4. Do not add any API keys. Show me the final file and tell me to fully quit and
   reopen Claude Desktop.
```

This route needs Node.js on your computer. Route A does not.

#### Route C — edit the configuration file yourself

1. **Open the settings file.** In Claude Desktop, open **Settings → Developer → Edit Config**. That
   button opens `claude_desktop_config.json` in your text editor and creates it if it is missing.

   <details>
   <summary>Can't find that menu? Open the file directly.</summary>

   | System  | File                                                              |
   | ------- | ----------------------------------------------------------------- |
   | macOS   | `~/Library/Application Support/Claude/claude_desktop_config.json` |
   | Windows | `%APPDATA%\Claude\claude_desktop_config.json`                     |
   | Linux   | `~/.config/Claude/claude_desktop_config.json`                     |

   On macOS the Settings window opens from **Claude** in the menu bar, not from the chat window. On
   Windows, check the Claude icon in the system tray. If the file does not exist, create it.

   </details>

2. **Paste the configuration.**

   If the file is **empty or brand new**, paste this entire block — the outer `{` and `}` matter:

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

   If the file **already has other servers**, keep them and add only the `singapore` entry, with a
   comma between entries:

   ```json
   {
     "mcpServers": {
       "some-server-you-already-had": {
         "command": "npx",
         "args": ["-y", "some-other-package"]
       },
       "singapore": {
         "command": "npx",
         "args": ["-y", "@olano/mcp-singapore"]
       }
     }
   }
   ```

   The same file is available at [`examples/claude-desktop.json`](examples/claude-desktop.json).

   <details>
   <summary><strong>On Windows?</strong> Use this version instead.</summary>

   Windows installs `npx` as a `.cmd` script, which some builds of Claude Desktop cannot start
   directly. If the plain version above shows an error, wrap it in `cmd /c`:

   ```json
   {
     "mcpServers": {
       "singapore": {
         "command": "cmd",
         "args": ["/c", "npx", "-y", "@olano/mcp-singapore"]
       }
     }
   }
   ```

   </details>

3. **Save the file and fully restart Claude Desktop.** Closing the window is not enough. Quit the
   app completely — **Claude → Quit** on macOS, or right-click the tray icon and choose **Quit** on
   Windows — then open it again.

4. **Confirm it worked.** Click the **+** button next to the message box and look under
   **Connectors**. You should see `singapore` listed with its tools. Then ask a question:

   > Show me the latest two-hour weather forecast for Singapore, with timestamps.

   The first question may take 20–30 seconds while `npx` downloads the package. After that it is
   fast.

If `singapore` does not appear, see [If something is not working](#if-something-is-not-working).
Reference details are in [Claude Desktop](docs/claude-desktop.md).

### Claude Code

> This covers both the `claude` terminal command and the **Code** tab in the Claude Desktop app.

Use the **plugin**. It installs the complete MCP server _and_ all eight Olano Agent Skills, which
teach Claude when to reach for which Singapore tool, so answers come back better sourced. It also
gives you a safe place to add the optional API keys later.

1. **Add the Olano marketplace.** Type this at the Claude Code prompt, exactly as shown, including
   the leading `/`:

   ```text
   /plugin marketplace add olano-ai/mcp-singapore
   ```

   This only registers the catalogue. Nothing is installed yet.

2. **Install the complete plugin:**

   ```text
   /plugin install olano-singapore@olano
   ```

   Choose **User scope** when it asks, so the plugin works in every project. If the summary says
   `Run /reload-plugins to activate.`, run that command too; otherwise the plugin is already live.

3. **Confirm and ask a question.** Run:

   ```text
   /mcp
   ```

   You should see `singapore` connected. Then try:

   > List every station on the Thomson-East Coast Line in order and identify the interchanges.

   The first call may take 20–30 seconds while the package downloads. After that it is fast.

#### Prefer to have Claude do it?

Paste this into Claude Code and it will run the setup and check it for you:

```text
Install the complete Olano Singapore plugin for me. Run
`npx -y @olano/sg-cli setup claude`, verify it with
`npx -y @olano/sg-cli doctor claude`, and tell me when to start a new session.
Do not ask me for optional API keys yet.
```

#### Prefer a terminal one-liner?

This does the same two steps without an interactive session, at user scope. It is safe to re-run
whenever you want to refresh the Olano marketplace:

```bash
npx -y @olano/sg-cli setup claude
npx -y @olano/sg-cli doctor claude
```

Start a new Claude Code session afterwards, or run `/reload-plugins` in an open one.

<details>
<summary><strong>Just the tools, without the Agent Skills</strong></summary>

```bash
claude mcp add --transport stdio --scope user singapore -- npx -y @olano/mcp-singapore
```

Start a new session and run `/mcp`. This installs every MCP tool but none of the packaged Agent
Skills, so Claude gets the same data with less guidance on how to use it. The plugin above is the
better default.

</details>

### Codex app

The Codex app and Codex CLI share the same MCP configuration, so you only need to install the server
once.

1. Open **Settings → MCP servers → Add server**.

2. Enter `singapore` as the name, choose **STDIO**, use `npx` as the command, and enter these
   arguments:

   ```text
   -y @olano/mcp-singapore
   ```

3. Save, select **Restart**, and type `/mcp` in a new conversation to confirm that `singapore` is
   connected.

Already installed it with the Codex CLI? Then there is nothing else to add. Restart the app and it
will use the same configuration.

### Codex CLI

1. Add the complete MCP server:

   ```bash
   codex mcp add singapore -- npx -y @olano/mcp-singapore
   ```

2. Confirm that it is enabled:

   ```bash
   codex mcp list
   ```

3. Start a new Codex session and run `/mcp`, then ask a question.

Prefer to ask Codex to do the installation? Paste this prompt:

```text
Install the complete Olano Singapore MCP for me. Run
`codex mcp add singapore -- npx -y @olano/mcp-singapore`, verify it with
`codex mcp list`, and tell me when to start a new session.
Do not request optional API keys yet.
```

The command intentionally has no `--profile` argument. With no profile selected,
`@olano/mcp-singapore` loads the complete suite.

### If something is not working

Find the row that matches what you see. The Node.js rows apply only to the `npx` routes — the Claude
Desktop extension has no such dependency.

| What you see                                       | What to do                                                                                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Double-clicking the `.mcpb` file does nothing      | Open Claude Desktop first, then drag the file onto its **Settings** window, or use **Settings → Extensions → Advanced settings → Install Extension…**.                                   |
| Claude Desktop warns the extension is not signed   | Expected. This project does not sign its bundles yet. Download only from the [releases page](https://github.com/olano-ai/mcp-singapore/releases).                                        |
| The extension installed but Claude ignores it      | Open **Settings → Extensions** and confirm it is enabled. Extensions apply to new messages, not to a conversation already in progress.                                                   |
| `singapore` is not listed at all                   | On the configuration-file route, you did not fully quit and reopen the app. Closing the window is not enough — quit it completely, then reopen.                                          |
| The server shows as failed or disconnected         | Run `node --version` in a terminal. If it is missing or below `v20`, install [Node.js](https://nodejs.org/) LTS and restart the app — or switch to the extension, which needs neither.   |
| It fails on Windows                                | Switch the config to `"command": "cmd"` with `"args": ["/c", "npx", "-y", "@olano/mcp-singapore"]`, then restart the app.                                                                |
| Claude Desktop says the config file is invalid     | A missing or extra comma, or a missing outer `{`. Paste your file into a JSON validator, or copy [`examples/claude-desktop.json`](examples/claude-desktop.json) over it and start again. |
| The first question is very slow                    | Expected on the `npx` routes; the package downloads on first run. The extension has no first-run download.                                                                               |
| Claude Code says `/plugin` is not a known command  | Update Claude Code: `npm install -g @anthropic-ai/claude-code@latest`, or `brew upgrade claude-code`. Then restart your terminal.                                                        |
| The plugin installed but the tools are missing     | Run `/reload-plugins` in the session, or start a new session. Then run `/mcp` again.                                                                                                     |
| A tool reports a missing environment variable      | That tool needs a free key from OneMap or LTA DataMall. Add it in **Settings → Extensions**, or see [Credentials and caching](#credentials-and-caching). Everything else works without.  |
| Claude answers from memory instead of using a tool | Ask for the source explicitly, for example "using the Singapore MCP tools, show the latest PSI readings with timestamps".                                                                |

Check the exact state of a Claude Code install at any time:

```bash
npx -y @olano/sg-cli doctor claude
```

Still stuck? [Open an issue](https://github.com/olano-ai/mcp-singapore/issues) with your app name,
your operating system, how you installed, and the output of `node --version`.

### Optional: choose a smaller profile

The quick-start commands above install everything. Later, experienced users can choose a focused
profile to send fewer tool definitions to the model.

| Profile    | Good for                                                        |
| ---------- | --------------------------------------------------------------- |
| `property` | HDB, private property, neighbourhoods, amenities, and mortgages |
| `mobility` | MRT/LRT, buses, roads, parking, taxis, routing, and COE         |
| `business` | Companies, UENs, formations, sectors, retail, and tourism       |
| `economy`  | GDP, prices, jobs, income, population, and trade                |
| `civic`    | Weather, health, education, childcare, safety, and services     |
| `finance`  | Official rates, mortgage scenarios, FX, income, and inflation   |
| `all`      | The complete Singapore suite                                    |

Each profile has its own Claude Code plugin. Install one the same way as the complete plugin:

```text
/plugin install olano-singapore-property@olano
```

Or select a profile from a terminal, where `--profile` narrows the MCP server directly:

```bash
npx -y @olano/sg-cli setup claude property
codex mcp add singapore-property -- npx -y @olano/mcp-singapore --profile property
```

For Claude Desktop, add `"--profile", "property"` to the `args` array in the config file. The
one-click extension always loads the complete suite; use the configuration-file route if you want a
profile there.

### Questions to try

- “List every station on the Thomson-East Coast Line in order and identify the interchanges.”
- “Find the nearest MRT or LRT stations to latitude 1.29027, longitude 103.851959.”
- “Find the official public ACRA records matching `Olano` and show the UEN and entity status.”
- “Show the latest two-hour weather forecast and PSI, with timestamps.”
- “Compare Singapore CPI and retail sales over exactly matched monthly periods.”
- “Stress-test a S$600,000 mortgage at 2.5%, 3.5%, and 4.5%, showing every assumption.”

More examples are available in [Example questions](#example-questions) or from:

```bash
npx -y @olano/sg-cli examples
```

**New here? Stop now and try a question.** The rest of this README documents packages, transports,
credentials, data sources, and development.

## More ways to run it

### Run without saving MCP configuration

```bash
npx -y @olano/mcp-singapore
```

Add it to a client that accepts the common `mcpServers` format:

```json
{
  "mcpServers": {
    "singapore": {
      "command": "npx",
      "args": ["-y", "@olano/mcp-singapore"],
      "env": {
        "DATA_GOV_SG_API_KEY": "optional-data-gov-key",
        "ONEMAP_TOKEN": "your-onemap-token",
        "LTA_DATAMALL_API_KEY": "your-lta-account-key",
        "OLANO_SG_CACHE_DIR": "/absolute/path/to/olano-sg-cache"
      }
    }
  }
}
```

Remove credentials you do not use and never commit real values. The server starts without any
credential; only tools that require one will return a missing-credential error.

### Smaller server-side tool profiles

The aggregate defaults to `all`. To reduce the tool definitions sent to a model, select a focused
production profile without losing MCP prompts or resources:

```bash
npx -y @olano/mcp-singapore --profile mobility
OLANO_SG_PROFILE=property npx -y @olano/mcp-singapore
```

The stable profiles are `mobility`, `property`, `business`, `economy`, `civic`, and `finance`.
`singapore_tool_profiles` is always available and returns each profile's prefix contract, exact live
tool count, and optional tool-name inventory. The same definitions power `olano-sg profiles` and
`olano-sg profile <name>`. An unknown profile fails at startup instead of silently falling back to
`all`.

### MCP over Streamable HTTP

```bash
npx -y @olano/mcp-singapore --transport http --host 127.0.0.1 --port 3000
```

The MCP endpoint is `http://127.0.0.1:3000/mcp`. Localhost is the default bind address. Add TLS,
authentication, request limits, and operational monitoring before exposing it to a network.

Focused servers use the same flags:

```bash
npx -y @olano/mcp-rail-sg --transport http --port 3001
npx -y @olano/mcp-weather --transport http --port 3002
```

### CLI

The npm package is `@olano/sg-cli`; its executable is `olano-sg`.

```bash
npx -y @olano/sg-cli list
npx -y @olano/sg-cli search rail
npx -y @olano/sg-cli examples
npx -y @olano/sg-cli examples property
npx -y @olano/sg-cli ask "Compare recent HDB resale prices in Bedok"
npx -y @olano/sg-cli datasets economy
npx -y @olano/sg-cli prompts
npx -y @olano/sg-cli tool weather_two_hour_forecast '{}'
npx -y @olano/sg-cli setup claude property
npx -y @olano/sg-cli doctor claude property
```

`ask` and its `query` alias use a deterministic local router. They recommend tools, extract obvious
arguments, and report missing inputs; they do not send the question to an external model or silently
execute the recommendation. Use `tool` for an explicit invocation.

For client-specific reference, updates, and validation, see
[Claude Desktop](docs/claude-desktop.md), [Claude Code plugins](docs/claude-code.md), and
[Codex and OpenAI plugins](docs/openai-plugins.md).

## Prompts and resources

The aggregate server packages reusable MCP prompts:

- `research-singapore`
- `research-neighbourhood`
- `research-company`
- `analyze-property`
- `analyze-mobility`

It also exposes read-only resources at `singapore://about`, `singapore://sources`, and
`singapore://examples`. Tool-based discovery is available through `singapore_prompt_categories`,
`singapore_prompt_examples`, `singapore_prompt_for_tool`, and `singapore_ask`.

## Packaged Agent Skills

The repository includes eight reusable workflows for clients that support Agent Skills:

- `research-singapore` — general locations, mobility, economy, population, environment, and public
  services research;
- `analyze-singapore-property` — HDB/private-property evidence, neighbourhood, transport, amenities,
  and educational mortgage scenarios;
- `research-singapore-business` — ACRA/UEN lookup, business formations, sectors, labour, inflation,
  exchange rates, retail, tourism, and trade context;
- `analyze-singapore-mobility` — MRT/LRT, bus, road, parking, taxi, routing, and COE analysis;
- `analyze-singapore-economy` — period- and unit-aware economic indicator analysis;
- `research-singapore-civic` — weather, health, education, population, safety, and public services;
- `analyze-singapore-finance` — official rates and transparent mortgage and affordability scenarios;
  and
- `develop-with-singapore-mcp` — profile selection, exact tool calls, credentials, transports, and
  troubleshooting.

See [skills/README.md](skills/README.md) for installation and usage guidance.

## Credentials and caching

| Variable               | Purpose                                                                    |
| ---------------------- | -------------------------------------------------------------------------- |
| `DATA_GOV_SG_API_KEY`  | Optional data.gov.sg key for production use and provider limits            |
| `ONEMAP_TOKEN`         | OneMap bearer token for authenticated OneMap tools and rail address lookup |
| `LTA_DATAMALL_API_KEY` | LTA DataMall subscriber Account Key for dynamic transport APIs             |
| `OLANO_SG_CACHE_DIR`   | Optional absolute directory for the persistent public-response cache       |
| `OLANO_SG_PROFILE`     | Optional aggregate tool profile; defaults to `all`                         |

Every provider uses an in-memory TTL cache. Setting `OLANO_SG_CACHE_DIR` additionally persists
eligible public responses between processes. Cache entries use provider-specific TTLs and hashed
keys, are partitioned by a hash of the request-header identity, and omit the entire query string from
stored source metadata. Response payloads can still contain addresses, company searches, or other
request results. Do not share one cache directory across untrusted tenants; protect it as application
data and clear it when retention requirements demand it. `singapore_cache_info` reports whether it is
enabled.

## Official upstream sources and attribution

The suite keeps source agency, dataset/table identifier, source URL, retrieval time, observation
period, units, and freshness caveats wherever the upstream format allows it.

- [data.gov.sg developer guide](https://guide.data.gov.sg/developer-guide/api-overview) — Singapore
  public datasets published by their named agencies, including ACRA, HDB, URA, MOE, ECDA, IRAS,
  STB, EMA, SPF, MOH, and NEA datasets used by the curated catalog.
- [OneMap API documentation](https://www.onemap.gov.sg/apidocs/) — Singapore Land Authority address,
  geocoding, and routing services.
- [LTA DataMall](https://datamall.lta.gov.sg/content/datamall/en.html) — Land Transport Authority
  dynamic transport APIs and downloadable rail datasets.
- [SingStat Table Builder](https://tablebuilder.singstat.gov.sg/) — Singapore Department of
  Statistics economic, business, labour, trade, and population tables.
- [Meteorological Service Singapore](https://www.weather.gov.sg/) — official weather context; the
  implemented real-time feeds are retrieved through data.gov.sg.
- [Official bank interest rates dataset](https://data.gov.sg/datasets/d_5fe5a4bb4a1ecc4d8a56a095832e2b24/view)
  — SingStat-published series sourced from the Monetary Authority of Singapore, including SORA and
  published bank interest-rate statistics.
- [Singapore Open Data Licence](https://data.gov.sg/open-data-licence) — licence applying to covered
  data.gov.sg materials.

Rail tools additionally disclose the exact LTA snapshot date and source URL through
`rail_source_metadata`. API availability, data accuracy, rate limits, licences, and upstream terms
remain controlled by the respective providers. Applications must comply with those terms and retain
required attribution.

## Financial-data boundary

Olano integrates only the free official mortgage reference-rate dataset described above. It does
not expose live SGX quotes, lender product offers, or insurance premiums because no stable free
official API with suitable production and redistribution terms has been verified. It does not scrape
comparison sites or label third-party quote data as official Singapore data. Use
`finance_singapore_data_availability` for the current boundary and official reference links.

## Safety and engineering

The servers are read-only. Zod validates inputs; upstream origins and paths are fixed in code;
requests use timeouts, bounded response sizes, retries, rate spacing, and caching; and tools return
explicit errors for missing credentials. Derived tools disclose assumptions and do not turn area,
company, crime, property, or finance data into unsupported personal conclusions.

## Development

Requires Node.js 20 or newer.

```bash
npm install
npm run format:check
npm run lint
npm test
npm run build
```

Inspect the aggregate server interactively:

```bash
npx @modelcontextprotocol/inspector node packages/singapore/dist/cli.js
```

Build and verify the Claude Desktop bundle. `check:mcpb` unpacks the packed `.mcpb` outside the
repository and starts it with the exact command its own manifest declares, so a dependency that only
resolves through the monorepo fails here rather than on a user's machine:

```bash
npm run build:mcpb
npm run check:mcpb
```

See [Architecture](docs/architecture.md), [Claude Desktop](docs/claude-desktop.md),
[Contributing](CONTRIBUTING.md), and [Security](SECURITY.md).

## Licence

Source code is released under the MIT License. Government data remains subject to the licence and
terms published by each source agency.
