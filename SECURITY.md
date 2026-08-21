# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Report it through GitHub's private
vulnerability reporting feature for this repository, with reproduction steps and the affected
package and version.

We aim to acknowledge reports within five business days. Do not include API keys, access tokens,
personal data, or other secrets in reports, logs, fixtures, or screenshots.

## What the software does

The servers are read-only. Zod validates every input; upstream origins and paths are fixed in code,
so no tool will fetch a URL a caller supplies. Requests use timeouts, bounded response sizes,
retries, rate spacing, and caching. Tools that need a credential return an explicit
missing-credential error rather than failing open.

Credentials are read from environment variables. They are never logged intentionally, and they are
passed only to the upstream service that requires them. Anyone deploying the Streamable HTTP
transport is responsible for authentication and TLS at the deployment boundary; the default bind
address is localhost precisely because the server does not provide them.

## Supply chain

This is a public repository, so anyone can open a pull request and have CI run their code on our
runners. Four properties keep that from mattering, and `npm run check:workflows` enforces every one
of them on each pull request, so a change that breaks one fails the pull request that introduces it:

| Property                                           | Why                                                                                                                                                                                                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `pull_request_target` or `workflow_run` trigger | Both run in the base repository's context, with secrets, while checking out fork code. That combination is the usual way public repositories leak publishing tokens. The plain `pull_request` trigger this repository uses gets a read-only token and no secrets. |
| Every action pinned to a full commit SHA           | A tag is mutable. Whoever controls an action's repository can repoint `v4` at anything, and it then runs with our token.                                                                                                                                          |
| Every workflow declares its own `permissions`      | Without one, jobs inherit the repository default, which may be write.                                                                                                                                                                                             |
| No `${{ }}` expression inside a `run:` body        | An expression holding attacker-controlled text — a pull request title, a branch name — is command injection when pasted into a shell. The same value passed through `env:` is inert.                                                                              |

Alongside those, CI runs `npm audit --audit-level=high`, and Dependabot raises weekly updates for
both npm dependencies and pinned action SHAs. Pinning without Dependabot trades one risk for
another: the pins simply go stale.

No workspace declares an `install`, `postinstall`, or `prepare` script, so `npm ci` does not execute
package code during installation.

`NPM_TOKEN` is scoped to the `npm` GitHub environment and is reachable only from the publish job.
Publishing prefers npm trusted publishing over the token; see [Publishing](docs/publishing.md).

## Releases

Releases run from a single workflow (**Actions → Release**), which requires write access to start —
an outside contributor cannot trigger one. It sets the version, runs the full gate, and only then
commits, tags, and publishes. If any check fails, nothing is committed, tagged, or published.

Bundles published to GitHub Releases are not signed. Claude Desktop reports the `.mcpb` as unsigned
during installation; that is expected for this project today. Download it only from
[this repository's releases](https://github.com/olano-ai/mcp-singapore/releases).

## Repository settings

Some protections live in GitHub settings rather than in this repository, so they cannot be enforced
by a file here. A maintainer should confirm all of these:

- **Branch protection on `main`.** Require a pull request and passing status checks. Add the
  **GitHub Actions** app to the ruleset's bypass list, otherwise the release workflow cannot push
  its version commit and every release fails after passing its checks.
- **Actions → "Require approval for all external contributors."** The default only prompts for
  first-time contributors. Fork pull requests get no secrets either way, but this stops arbitrary
  code running on the runners until a maintainer looks at it.
- **Actions → Workflow permissions → "Read repository contents and packages permissions."** Each
  workflow here already declares what it needs; this makes read-only the default for anything that
  forgets.
- **Secret scanning and push protection.** Free for public repositories. Push protection rejects a
  commit containing a recognised credential before it reaches the remote.
- **Private vulnerability reporting.** Enables the flow this policy asks reporters to use.
- **Environment protection on `npm`.** Required reviewers on that environment mean a publish waits
  for a human even if the release workflow is started by mistake.
