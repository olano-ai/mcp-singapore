# Architecture

## Goals

Singapore MCP is a monorepo because the public packages share transport, resilience, security, and
tool-design conventions. Each agency package remains independently installable, while the aggregate
package provides a single entry point and cross-agency tools.

```mermaid
flowchart TD
  C[MCP client] -->|stdio or HTTP| S[@olano/mcp-singapore]
  S --> D[data.gov.sg tools]
  S --> O[OneMap tools]
  S --> L[LTA tools]
  S --> W[Weather tools]
  D & O & L & W --> R[Shared safe HTTP runtime]
```

## Package contract

Every provider package exports two functions:

- `register...Tools(server)` adds its namespaced tools to an existing `McpServer`.
- `create...Server()` creates its independently runnable server.

The aggregate package calls all registration functions. Cross-agency tools live only in the
aggregate package.

## Transport

Stdio is the default for local clients. `--transport http` exposes a Streamable HTTP endpoint at
`/mcp`. Server factories produce a fresh MCP server where required by the SDK transport model.

## Upstream safety

- Base URLs and paths are maintained in source code; callers cannot supply arbitrary URLs.
- Zod schemas constrain inputs, coordinate ranges, identifiers, pagination, and enums.
- Requests use timeouts, bounded responses, short caches, start-rate limiting, and bounded
  exponential retries.
- Secrets come from environment variables and are placed only in provider-specific headers.
- Tools are read-only.

An internet-facing HTTP deployment must add TLS, authentication, request limits, and operational
monitoring at the gateway or application boundary.
