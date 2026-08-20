# Publishing

The npm packages use the `@olano` scope and are published from GitHub Actions.
The workflow supports npm trusted publishing (OIDC) and uses the `NPM_TOKEN`
GitHub secret to bootstrap packages that do not yet exist on npm. After every
package has a trusted publisher configured, the token fallback can be removed.

## Release process

1. Update the root and all workspace package versions to the same value.
2. Merge the release commit into `main`.
3. Push an annotated tag from that commit whose name is exactly `v<version>`
   (for example, `v0.3.0`). The tag must point to a commit contained in `main`.
4. Approve the `npm` GitHub environment deployment if approval is enabled.

Pushing the tag starts the workflow; creating a GitHub Release is optional and
does not publish a second time. The workflow runs the build, formatting, lint,
tests, the mandatory capability-coverage contract, metadata validation, and dry-run
package-content checks before publishing all workspaces in topological
dependency order. A safe rerun skips package versions already present on npm.

After npm accepts the aggregate package, the workflow verifies the SHA-256 of a pinned official
`mcp-publisher` binary, authenticates to the official MCP Registry with GitHub OIDC, and publishes
`server.json`. A safe rerun checks the exact registry version first and skips it when present.

For v0.3.0 this includes the core provider packages, catalog, analytics,
insights, rail, the optional finance adapter when retained, the aggregate
`@olano/mcp-singapore` server, and `@olano/sg-cli`. The publisher discovers
workspaces from `packages/*`, so future workspaces are included automatically.

## npm trusted publisher

Configure the following trusted publisher on every published package:

- Provider: GitHub Actions
- GitHub organization or user: `olano-ai`
- Repository: `mcp-singapore`
- Workflow filename: `publish.yml`
- Environment: `npm`

The workflow requires `contents: read` and `id-token: write`. Public packages
are explicitly published with `--access public --provenance`. The workflow uses
an npm CLI version that supports trusted publishing.

## Bootstrap token

Store an npm automation/granular token as the `NPM_TOKEN` secret in the `npm`
GitHub environment. It must be authorized to create public packages in the
`@olano` organization and must not require an interactive OTP. Do not commit a
token to `.npmrc`, workflow files, package metadata, or repository secrets in
plain text.

After the first successful publish, configure the trusted publisher above for
each new npm package, verify a tokenless release, then rotate and remove the
bootstrap token.

## Local preflight

From a clean checkout using Node.js 22 or newer:

```bash
npm ci
npm run build
npm run format:check
npm run lint
npx vitest run
npm run check:plugins
npm exec --yes --package='@anthropic-ai/claude-code@2.1.237' -- claude plugin validate .
RELEASE_TAG="v$(node -p "require('./package.json').version")" node scripts/check-release.mjs
node scripts/verify-packages.mjs
docker build --tag olano-mcp-singapore:local .
```

The preflight never publishes. Actual publishing is restricted to the tag
workflow in `olano-ai/mcp-singapore`.
