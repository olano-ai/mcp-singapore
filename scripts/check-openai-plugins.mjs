import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const rootPackage = readJson('package.json');
const marketplace = readJson('.agents/plugins/marketplace.json');

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
assert(
  marketplace.interface?.displayName === 'Olano Singapore',
  'Marketplace display name is stale.',
);
assert(Array.isArray(marketplace.plugins), 'Marketplace plugins must be an array.');
assert(marketplace.plugins.length === expected.size, 'Marketplace plugin count is unexpected.');
assert(readText('PRIVACY.md').startsWith('# Privacy Policy'), 'PRIVACY.md is missing.');
assert(readText('TERMS.md').startsWith('# Terms of Use'), 'TERMS.md is missing.');

const seen = new Set();
for (const entry of marketplace.plugins) {
  assert(!seen.has(entry.name), `Duplicate marketplace plugin: ${entry.name}`);
  seen.add(entry.name);

  const contract = expected.get(entry.name);
  assert(contract, `Unexpected marketplace plugin: ${entry.name}`);
  assert(
    JSON.stringify(entry.source) ===
      JSON.stringify({ source: 'local', path: `./plugins/${entry.name}` }),
    `${entry.name} has an unexpected source.`,
  );
  assert(entry.policy?.installation === 'AVAILABLE', `${entry.name} must be installable.`);
  assert(entry.policy?.authentication === 'ON_INSTALL', `${entry.name} auth policy is stale.`);

  const pluginRoot = `plugins/${entry.name}`;
  assert(statSync(resolve(root, pluginRoot)).isDirectory(), `${pluginRoot} must be a directory.`);
  const manifest = readJson(`${pluginRoot}/.codex-plugin/plugin.json`);
  assert(manifest.name === entry.name, `${entry.name} manifest name does not match.`);
  assert(manifest.version === rootPackage.version, `${entry.name} manifest version is stale.`);
  assert(manifest.license === 'MIT', `${entry.name} manifest must declare MIT.`);
  assert(manifest.skills === './skills/', `${entry.name} skills path is stale.`);
  assert(manifest.mcpServers === './.codex-mcp.json', `${entry.name} MCP path is stale.`);
  assert(manifest.interface?.developerName === 'Olano', `${entry.name} developer is stale.`);
  assert(
    manifest.interface?.privacyPolicyURL ===
      'https://github.com/olano-ai/mcp-singapore/blob/main/PRIVACY.md',
    `${entry.name} privacy URL is stale.`,
  );
  assert(
    manifest.interface?.termsOfServiceURL ===
      'https://github.com/olano-ai/mcp-singapore/blob/main/TERMS.md',
    `${entry.name} terms URL is stale.`,
  );
  assert(
    Array.isArray(manifest.interface?.defaultPrompt) &&
      manifest.interface.defaultPrompt.length >= 2,
    `${entry.name} needs starter prompts.`,
  );

  const iconPath = `${pluginRoot}/${manifest.interface.logo.replace(/^\.\//, '')}`;
  assert(readText(iconPath).startsWith('<svg'), `${entry.name} needs an SVG logo.`);

  const mcp = readJson(`${pluginRoot}/.codex-mcp.json`);
  const servers = Object.values(mcp);
  assert(servers.length === 1, `${entry.name} must declare exactly one MCP server.`);
  const server = servers[0];
  assert(server.command === 'npx', `${entry.name} must launch with npx.`);
  assert(
    JSON.stringify(server.args) ===
      JSON.stringify([
        '-y',
        `@olano/mcp-singapore@${rootPackage.version}`,
        '--profile',
        contract.profile,
      ]),
    `${entry.name} MCP package or profile is stale.`,
  );
  assert(server.env === undefined, `${entry.name} must inherit environment variables safely.`);

  for (const skill of contract.skills) {
    const canonical = readText(`skills/${skill}/SKILL.md`);
    const packaged = readText(`${pluginRoot}/skills/${skill}/SKILL.md`);
    assert(packaged === canonical, `${entry.name} contains a stale copy of ${skill}.`);
  }
}

for (const name of expected.keys()) {
  assert(seen.has(name), `Missing marketplace plugin: ${name}`);
}

process.stdout.write(
  `Verified ${expected.size} Codex plugins with repository marketplace, local MCP profiles, and policy metadata.\n`,
);
