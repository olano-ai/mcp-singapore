import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * Sets one version across every file that carries it.
 *
 * CI enforces version parity in several places at once — `check-release.mjs` for the workspaces and
 * server.json, `check-claude-plugins.mjs` and `check-openai-plugins.mjs` for the marketplace, the
 * plugin manifests, and the pinned `@olano/mcp-singapore@<version>` in each plugin's MCP config. A
 * release that misses any one of them fails after the tag exists, which is the expensive moment to
 * find out. This script is what the release workflow runs so they all move together.
 *
 *   node scripts/bump-version.mjs --bump patch
 *   node scripts/bump-version.mjs --to 1.0.0
 *   node scripts/bump-version.mjs --bump minor --dry-run
 *
 * Files under submissions/ are left alone on purpose: they record what was sent to a directory at a
 * point in time, so rewriting their version would falsify the record.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const AGGREGATE = '@olano/mcp-singapore';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

const dryRun = process.argv.includes('--dry-run');
const readJson = (file) => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'));

const current = readJson('package.json').version;
if (!SEMVER.test(current)) throw new Error(`Current version ${current} is not a release semver.`);

function nextVersion() {
  const exact = argument('--to');
  if (exact) {
    if (!SEMVER.test(exact)) throw new Error(`--to ${exact} is not a release semver.`);
    return exact;
  }
  const bump = argument('--bump') ?? 'patch';
  const [major, minor, patch] = current.split('.').map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  if (bump === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`--bump must be major, minor, or patch; received ${bump}`);
}

const version = nextVersion();
if (version === current) throw new Error(`Version is already ${version}.`);

const changed = [];

/**
 * Rewrites the version in one JSON file as text.
 *
 * Re-serialising the parsed document would work, but `JSON.stringify` expands inline objects that
 * Prettier then keeps expanded, so every release diff would carry unrelated reformatting. Replacing
 * the version token in place keeps release diffs to the lines that actually changed. `verify` then
 * parses the result and asserts the fields that matter, so a file whose shape drifts fails here
 * rather than silently going unbumped.
 */
function edit(file, verify) {
  const absolute = path.join(ROOT, file);
  const original = readFileSync(absolute, 'utf8');
  const updated = original
    .split(`${AGGREGATE}@${current}`)
    .join(`${AGGREGATE}@${version}`)
    .split(`"${current}"`)
    .join(`"${version}"`);

  if (updated.includes(`"${current}"`) || updated.includes(`${AGGREGATE}@${current}`)) {
    throw new Error(`${file}: still references ${current} after the rewrite.`);
  }

  const document = JSON.parse(updated);
  for (const [description, actual] of verify(document)) {
    if (actual !== version) {
      throw new Error(`${file}: ${description} is ${actual}, expected ${version}.`);
    }
  }

  if (updated === original) return;
  changed.push(file);
  if (!dryRun) writeFileSync(absolute, updated);
}

const directories = (parent) =>
  readdirSync(path.join(ROOT, parent), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

edit('package.json', (root) => [['version', root.version]]);

for (const name of directories('packages')) {
  edit(`packages/${name}/package.json`, (manifest) => [
    ['version', manifest.version],
    ...Object.entries(manifest.dependencies ?? {})
      .filter(([dependency]) => dependency.startsWith('@olano/'))
      .map(([dependency, pinned]) => [`dependency ${dependency}`, pinned]),
  ]);
}

edit('server.json', (server) => [
  ['version', server.version],
  ...(server.packages ?? []).map((entry, index) => [`packages[${index}].version`, entry.version]),
]);

edit('.claude-plugin/marketplace.json', (marketplace) => [
  ['version', marketplace.version],
  ...(marketplace.plugins ?? []).map((plugin) => [`${plugin.name} version`, plugin.version]),
]);

/** The pin each plugin launches the server with, as it appears in an npx argument list. */
const pinnedArgument = (config) =>
  Object.values(config)
    .flatMap((server) => server.args ?? [])
    .filter((value) => typeof value === 'string' && value.startsWith(`${AGGREGATE}@`))
    .map((value) => ['pinned server', value.slice(`${AGGREGATE}@`.length)]);

for (const name of directories('plugins')) {
  for (const manifest of ['.claude-plugin/plugin.json', '.codex-plugin/plugin.json']) {
    edit(`plugins/${name}/${manifest}`, (plugin) => [['version', plugin.version]]);
  }
  edit(`plugins/${name}/.mcp.json`, (config) => pinnedArgument(config.mcpServers ?? {}));
  edit(`plugins/${name}/.codex-mcp.json`, (config) => pinnedArgument(config));
}

if (!dryRun) {
  // The lockfile carries every workspace version and is not covered by the rewrite above.
  execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

process.stdout.write(
  `${dryRun ? 'Would set' : 'Set'} version ${current} -> ${version} across ${changed.length} files.\n`,
);
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `version=${version}\ntag=v${version}\n`, { flag: 'a' });
}
