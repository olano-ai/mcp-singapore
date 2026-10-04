import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const rootPackage = readJson('package.json');
const marketplace = readJson('.claude-plugin/marketplace.json');

const expected = new Map([
  [
    'olano-singapore',
    {
      profile: 'all',
      skills: [
        'research-singapore',
        'analyze-singapore-property',
        'research-singapore-business',
        'analyze-singapore-mobility',
        'analyze-singapore-economy',
        'research-singapore-civic',
        'analyze-singapore-finance',
        'develop-with-singapore-mcp',
      ],
    },
  ],
  [
    'olano-singapore-property',
    { profile: 'property', skills: ['analyze-singapore-property', 'analyze-singapore-finance'] },
  ],
  ['olano-singapore-mobility', { profile: 'mobility', skills: ['analyze-singapore-mobility'] }],
  ['olano-singapore-business', { profile: 'business', skills: ['research-singapore-business'] }],
  ['olano-singapore-economy', { profile: 'economy', skills: ['analyze-singapore-economy'] }],
  ['olano-singapore-civic', { profile: 'civic', skills: ['research-singapore-civic'] }],
  ['olano-singapore-finance', { profile: 'finance', skills: ['analyze-singapore-finance'] }],
]);

function readText(path) {
  return readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n');
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(marketplace.name === 'olano', 'Marketplace name must be olano.');
assert(marketplace.owner?.name === 'Olano', 'Marketplace owner must be Olano.');
assert(marketplace.version === rootPackage.version, 'Marketplace version must match package.json.');
assert(Array.isArray(marketplace.plugins), 'Marketplace plugins must be an array.');
assert(marketplace.plugins.length === expected.size, 'Marketplace plugin count is unexpected.');

const seen = new Set();
for (const entry of marketplace.plugins) {
  assert(!seen.has(entry.name), `Duplicate marketplace plugin: ${entry.name}`);
  seen.add(entry.name);
  const contract = expected.get(entry.name);
  assert(contract, `Unexpected marketplace plugin: ${entry.name}`);
  assert(entry.source === `./plugins/${entry.name}`, `${entry.name} has an unexpected source.`);
  assert(entry.version === rootPackage.version, `${entry.name} marketplace version is stale.`);

  const pluginRoot = `plugins/${entry.name}`;
  assert(statSync(resolve(root, pluginRoot)).isDirectory(), `${pluginRoot} must be a directory.`);
  const manifest = readJson(`${pluginRoot}/.claude-plugin/plugin.json`);
  assert(manifest.name === entry.name, `${entry.name} manifest name does not match.`);
  assert(manifest.version === rootPackage.version, `${entry.name} manifest version is stale.`);
  assert(manifest.license === 'MIT', `${entry.name} manifest must declare MIT.`);
  assert(readText(`${pluginRoot}/README.md`).startsWith('# '), `${entry.name} needs a README.`);

  for (const [key, option] of Object.entries(manifest.userConfig ?? {})) {
    assert(
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(key),
      `${entry.name} has invalid userConfig key ${key}.`,
    );
    assert(
      option.type && option.title && option.description,
      `${entry.name} option ${key} is incomplete.`,
    );
    assert(option.sensitive === true, `${entry.name} option ${key} must be stored as sensitive.`);
  }

  const mcp = readJson(`${pluginRoot}/.mcp.json`);
  const servers = Object.values(mcp.mcpServers ?? {});
  assert(servers.length === 1, `${entry.name} must declare exactly one MCP server.`);
  const server = servers[0];
  // The plugin runs the server it carries (plugins/<name>/server, written by
  // scripts/build-plugin-server.mjs), not a package fetched at install time: Anthropic's plugin
  // directory reviews the code inside the plugin.
  assert(server.command === 'node', `${entry.name} must launch its vendored server with node.`);
  assert(
    JSON.stringify(server.args) ===
      JSON.stringify([
        '${CLAUDE_PLUGIN_ROOT}/server/node_modules/@olano/mcp-singapore/dist/cli.js',
        '--profile',
        contract.profile,
      ]),
    `${entry.name} MCP entry point or profile is stale.`,
  );
  assert(
    readJson(`${pluginRoot}/server/node_modules/@olano/mcp-singapore/package.json`).version ===
      rootPackage.version,
    `${entry.name} carries a stale vendored server; run npm run build && npm run build:plugin-server.`,
  );
  for (const value of Object.values(server.env ?? {})) {
    const match = /^\$\{user_config\.([A-Za-z_][A-Za-z0-9_]*)\}$/.exec(value);
    assert(match, `${entry.name} has an invalid MCP environment substitution.`);
    assert(manifest.userConfig?.[match[1]], `${entry.name} references undeclared ${match[1]}.`);
  }

  const actualSkills = contract.skills.toSorted();
  for (const skill of actualSkills) {
    const canonical = readText(`skills/${skill}/SKILL.md`);
    const packaged = readText(`${pluginRoot}/skills/${skill}/SKILL.md`);
    assert(packaged === canonical, `${entry.name} contains a stale copy of ${skill}.`);
  }
}

for (const name of expected.keys()) {
  assert(seen.has(name), `Missing marketplace plugin: ${name}`);
}

// Anthropic's plugin directory rejects a plugin whose launcher, skill or script text runs a package
// without an exact version, because that code can change after review. Every npx invocation of an
// @olano package in a skill must carry @<release version>; the packaged copies are byte-identical to
// these canonical files (checked above), so checking the canonical ones covers both.
const invocation = /npx\s+(?:-y\s+)?(@olano\/[a-z0-9-]+)(@[^\s`'"]+)?/g;
for (const skill of readdirSync('skills', { withFileTypes: true }).filter((e) => e.isDirectory())) {
  const file = `skills/${skill.name}/SKILL.md`;
  for (const match of readText(file).matchAll(invocation)) {
    assert(
      match[2] === `@${rootPackage.version}`,
      `${file} runs ${match[1]}${match[2] ?? ''} unpinned or stale; use ${match[1]}@${rootPackage.version}.`,
    );
  }
}

process.stdout.write(
  `Verified ${expected.size} Claude Code plugins and ${[...expected.values()].reduce((sum, item) => sum + item.skills.length, 0)} packaged skill copies.\n`,
);
