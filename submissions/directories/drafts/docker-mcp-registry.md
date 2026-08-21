# Docker MCP Catalog — pull request

**Where:** https://github.com/docker/mcp-registry

**Mechanism:** fork, add `servers/olano-singapore/server.yaml`, open a pull request. On approval
Docker builds, signs, and publishes the image to `mcp/olano-singapore` on Docker Hub, and the
catalog entry appears within about 24 hours. The entry also surfaces in Docker Desktop's MCP
Toolkit.

**Effort:** the largest of the remaining submissions. Generate the manifest with the repository's
own tooling rather than hand-writing it:

```bash
task wizard
# or
task create -- --category <category> https://github.com/olano-ai/mcp-singapore
```

**Advantage worth noting:** this repository already ships a working `Dockerfile` that CI builds and
smoke-tests on every run, so the containerised path is genuinely viable here.

**Confirm before filing:** re-read `CONTRIBUTING.md` for the current required fields, and pin
`source.commit` to the exact commit being submitted.

---

## Values to supply

| Field                | Value                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `name`               | `olano-singapore`                                                                                                |
| `type`               | `server`                                                                                                         |
| `meta.category`      | pick from the categories listed in `CONTRIBUTING.md` on the day you file                                         |
| `meta.tags`          | `singapore`, `public-data`, `transport`, `property`, `economy`, `weather`                                        |
| `about.title`        | Olano Singapore MCP                                                                                              |
| `about.description`  | Singapore public data across mobility, property, business, the economy, civic services and finance.              |
| `about.icon`         | a stable HTTPS URL to the Olano Singapore mark                                                                   |
| `source.project`     | https://github.com/olano-ai/mcp-singapore                                                                        |
| `source.commit`      | the exact commit being submitted                                                                                 |
| `config.description` | All three API keys are optional; without them the server still runs with reduced coverage and lower rate limits. |

## Optional secrets to declare

| `name`                         | `env`                  | notes                               |
| ------------------------------ | ---------------------- | ----------------------------------- |
| `olano-singapore.datagov_key`  | `DATA_GOV_SG_API_KEY`  | optional, raises data.gov.sg limits |
| `olano-singapore.onemap_token` | `ONEMAP_TOKEN`         | optional, geocoding and routing     |
| `olano-singapore.lta_key`      | `LTA_DATAMALL_API_KEY` | optional, live transport feeds      |

Docker's schema requires an `example` for each secret. Use a clearly fake placeholder — never a
real key.
