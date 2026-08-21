# Publishing

The npm packages use the `@olano` scope and are published from GitHub Actions.
The workflow supports npm trusted publishing (OIDC) and uses the `NPM_TOKEN`
GitHub secret to bootstrap packages that do not yet exist on npm. After every
package has a trusted publisher configured, the token fallback can be removed.

## Release process

Releasing is one button. Open **Actions → Release → Run workflow**, choose
`patch`, `minor`, or `major`, and run it. Everything else is automatic.

The run does this, in order:

1. Sets the new version across all 43 files that carry one — the root and every
   workspace package, the internal `@olano/*` dependency pins, `server.json`,
   the plugin marketplace, each plugin manifest, the pinned
   `@olano/mcp-singapore@<version>` in every plugin's MCP config, and the
   lockfile. `scripts/bump-version.mjs` does this and fails loudly if any file
   still references the old version afterwards.
2. Runs the full release gate against the bumped tree: build, formatting, lint,
   tests, the capability-coverage contract, the generated brand assets, both
   plugin checks, the official Claude Code plugin validator, release metadata,
   package-content checks, and a build and verify of the Claude Desktop bundle.
3. Commits `chore: release v<version>` to `main` and pushes the annotated tag.
4. Calls `publish.yml`, which publishes every workspace to npm in dependency
   order, publishes `server.json` to the MCP Registry, and creates the GitHub
   Release with the `.mcpb` bundle attached.

Nothing is committed or tagged until step 2 passes, so a failed run leaves
`main` untouched. Tick **dry run** to stop after step 2.

Two inputs are worth knowing. **version** sets an exact version and overrides
the bump, for a first stable release or a pre-planned number. **dry run**
validates without releasing.

The workflow pushes directly to `main`. If `main` has branch protection that
blocks pushes, allow `github-actions[bot]` to bypass it, or the release step
fails after the checks have already passed.

Approve the `npm` GitHub environment deployment if approval is enabled on it.

### Releasing by tag instead

`publish.yml` still runs on any pushed `v*` tag, so the manual path works
unchanged: bump the versions yourself, merge to `main`, and push an annotated
`v<version>` tag from a commit contained in `main`. A safe rerun skips package
versions already present on npm and a registry version that already exists.

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
npm run check:brand
npm run check:plugins
npm exec --yes --package='@anthropic-ai/claude-code@2.1.237' -- claude plugin validate .
RELEASE_TAG="v$(node -p "require('./package.json').version")" node scripts/check-release.mjs
node scripts/verify-packages.mjs
npm run build:mcpb
npm run check:mcpb
docker build --tag olano-mcp-singapore:local .
```

To preview a version bump without touching anything:

```bash
node scripts/bump-version.mjs --bump minor --dry-run
```

The preflight never publishes. Actual publishing is restricted to the tag
workflow in `olano-ai/mcp-singapore`.
