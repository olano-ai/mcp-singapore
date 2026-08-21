# Distribution and submission runbook

This directory is the operational record for publishing the Olano Singapore MCP suite to public
directories. It holds the exact copy to submit, the mechanics for each destination, and an honest
status for each one.

Release under submission: **0.3.0**

## What is already live

| Channel                   | Status    | Identifier / evidence                                                  |
| ------------------------- | --------- | ---------------------------------------------------------------------- |
| npm                       | published | `@olano/mcp-singapore@0.3.0`, `latest` dist-tag                        |
| Official MCP Registry     | published | `io.github.olano-ai/mcp-singapore@0.3.0`, `status: active`, `isLatest` |
| GitHub marketplace source | live      | `/plugin marketplace add olano-ai/mcp-singapore`                       |
| Codex plugin marketplace  | live      | `codex plugin marketplace add olano-ai/mcp-singapore`                  |

Registry publication is automated by `.github/workflows/publish.yml` on a `v*` tag and is
idempotent, so a rerun skips a version that is already present.

## What still needs a human

Every remaining destination is gated on a form, an issue, or a pull request that must be filed by a
person with the relevant account. None of them can be completed from CI.

| Destination                  | Mechanism                             | Prepared copy                               |
| ---------------------------- | ------------------------------------- | ------------------------------------------- |
| Anthropic `claude-community` | web form (account required)           | `anthropic/claude-community-form.md`        |
| mcp.so                       | comment on a public GitHub issue      | `directories/drafts/mcp-so-comment.md`      |
| Cline MCP Marketplace        | new issue from a template             | `directories/drafts/cline-marketplace.md`   |
| Docker MCP Catalog           | pull request adding `server.yaml`     | `directories/drafts/docker-mcp-registry.md` |
| `awesome-mcp-servers`        | pull request editing `README.md`      | `directories/drafts/awesome-mcp-servers.md` |
| OpenAI Plugins Directory     | upload bundle + review metadata       | `openai/`                                   |
| Smithery                     | blocked — see `directories/README.md` | not prepared                                |

## Suggested order

1. **Anthropic `claude-community`** — the highest-value destination and the slowest to review.
   Submit the aggregate plugin plus the six focused plugins.
2. **mcp.so** and **Cline** — a single comment and a single issue; both are quick.
3. **`awesome-mcp-servers`** — a small pull request against a widely read list.
4. **Docker MCP Catalog** — the most involved, because it needs a `server.yaml` and a container
   review.
5. **Smithery** — only after the project ships a public HTTPS endpoint or an MCPB bundle.

## Verified facts to reuse in any submission

These were measured against the built `0.3.0` server rather than copied from documentation.

| Plugin                     | MCP profile | Tools | Bundled skills |
| -------------------------- | ----------- | ----: | -------------: |
| `olano-singapore`          | `all`       |   291 |              8 |
| `olano-singapore-economy`  | `economy`   |    87 |              1 |
| `olano-singapore-civic`    | `civic`     |    73 |              1 |
| `olano-singapore-property` | `property`  |    63 |              2 |
| `olano-singapore-business` | `business`  |    58 |              1 |
| `olano-singapore-finance`  | `finance`   |    55 |              1 |
| `olano-singapore-mobility` | `mobility`  |    50 |              1 |

Every profile also exposes 5 prompts and 3 resources. All seven plugins and the root marketplace
pass `claude plugin validate`.

## Keeping this honest

`directories/mcp-directories.json` distinguishes `published` from `prepared`, `unverified`, and
`blocked`. Only move an entry to `published` once the listing is publicly visible, and record the
evidence in the same entry. Do not describe a prepared submission as a live listing in the README
or in any marketing copy.
