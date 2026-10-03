# Submit Singapore MCP to the directories (about 15 minutes in total)

Everything is prepared. Each step below is a paste and a click, done while signed in to the GitHub
account (or Claude account) that should appear as the submitter. Checked on 2026-10-03 against
release **0.4.1** (latest on npm and the Official MCP Registry). After each one, update its `status`
in [`directories/mcp-directories.json`](directories/mcp-directories.json).

Why it matters: each listing is a link back to the project, and the project page credits olano.ai and
olano.sg. One MCP directory (allmcps.com) is already one of only two outside sites linking to
olano.sg.

## 1. mcp.so (2 minutes): a comment

1. Open https://github.com/chatmcp/mcpso/issues/1
2. Scroll to the comment box at the bottom.
3. Paste the text under "Comment body" in
   [`directories/drafts/mcp-so-comment.md`](directories/drafts/mcp-so-comment.md) (everything after
   that heading).
4. Click **Comment**.

## 2. awesome-mcp-servers (5 minutes): one line in a list

1. Open https://github.com/punkpeye/awesome-mcp-servers/edit/main/README.md. GitHub offers to
   **fork** the repository; accept.
2. Press Ctrl+F (Cmd+F on Mac) and search for `Osseni94/keyneg-mcp`.
3. Put the cursor at the **start of that line**, press Enter to make an empty line above it, and
   paste this on the empty line:

   ```markdown
   - [olano-ai/mcp-singapore](https://github.com/olano-ai/mcp-singapore) 📇 ☁️ - 291 tools for Singapore open data: mobility, property, business, economy, civic services, and finance. Powered by data.gov.sg, OneMap, LTA DataMall, and SingStat. All API keys optional. Install: `npx -y @olano/mcp-singapore`.
   ```

   The line above it should be `mbrummerstedt/powerbi-analyst-mcp`; the line below it,
   `Osseni94/keyneg-mcp`.

4. Click **Commit changes…**, set the message to `Add Olano Singapore MCP server`, and click
   **Propose changes**.
5. On the next page click **Create pull request**, paste the "Pull request body" from
   [`directories/drafts/awesome-mcp-servers.md`](directories/drafts/awesome-mcp-servers.md), and
   click **Create pull request**.

## 3. Cline MCP Marketplace (5 minutes): an issue with a logo

1. Download the logo:
   https://raw.githubusercontent.com/olano-ai/mcp-singapore/main/assets/olano-singapore-400.png
   (400×400 PNG).
2. Open https://github.com/cline/mcp-marketplace/issues/new?template=mcp-server-submission.yml
3. Fill the form from [`directories/drafts/cline-marketplace.md`](directories/drafts/cline-marketplace.md):
   - **GitHub Repo URL:** `https://github.com/olano-ai/mcp-singapore`
   - **Logo:** drag in the PNG from step 1.
   - **Reason for addition:** paste that section of the draft.
4. Tick the installation-testing box **only if** you have handed Cline the repository and watched it
   install the server. [`../llms-install.md`](../llms-install.md) is the guide it will follow.
5. Click **Submit new issue**.

## 4. Anthropic Claude plugin directory (5 minutes per plugin): a web form

1. Open https://clau.de/plugin-directory-submission and sign in to Claude.
2. Submit **`olano-singapore`** (the complete plugin) first. Copy each answer from
   [`anthropic/claude-community-form.md`](anthropic/claude-community-form.md): the shared answers,
   then section "1. olano-singapore".
3. The six focused plugins (property, mobility, business, economy, civic, finance) can follow later,
   using the same file. They are optional.

## 5. OpenAI Plugins Directory: not a one-click step yet

This needs a skills-only upload bundle built from `plugins/*/skills` (without `.codex-mcp.json`) and
uploaded through OpenAI's developer portal with the metadata in
[`openai/focused-plugins.json`](openai/focused-plugins.json). Do it in a development session; it is
not urgent for search visibility.

## Already done, no action needed

- **Official MCP Registry** and **npm**: published automatically on each release tag (0.4.1).
- **PulseMCP**: copies from the Official MCP Registry automatically.
- **Glama**: may already list the server at https://glama.ai/mcp/servers/olano-ai/mcp-singapore.
  Open it in a browser. If it loads, click **Claim** and set the Glama row to `published`.
