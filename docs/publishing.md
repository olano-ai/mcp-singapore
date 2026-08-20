# Publishing

The npm packages use the `@olano` scope and are published from GitHub Actions.
The release workflow uses npm trusted publishing (OIDC), so it does not need a
long-lived npm token after the initial package bootstrap.

## Release process

1. Update the root and all workspace package versions to the same value.
2. Merge the release commit into `main`.
3. Create a GitHub Release whose tag is exactly `v<version>` (for example,
   `v0.1.0`).
4. Approve the `npm` GitHub environment deployment if approval is enabled.

The workflow runs formatting, linting, tests, release metadata validation, and
package-content checks before publishing in dependency order.

## npm trusted publisher

Configure the following trusted publisher on every published package:

- Provider: GitHub Actions
- GitHub organization or user: `olano-ai`
- Repository: `mcp-singapore`
- Workflow filename: `publish.yml`
- Environment: `npm`

The workflow requires `contents: read` and `id-token: write`. Public packages
receive npm provenance attestations automatically when published through the
trusted publisher.
