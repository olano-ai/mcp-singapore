import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createSingaporeServer } from '../packages/singapore/dist/index.js';
import { renderOlanoIcon } from './olano-mark.mjs';

/**
 * Builds the Claude Desktop MCP Bundle (.mcpb).
 *
 * The bundle is self-contained: it carries every Olano package and third-party dependency the
 * aggregate server needs, so Claude Desktop runs it with its own Node runtime and the user never
 * installs Node.js, edits claude_desktop_config.json, or waits for an npx download.
 *
 * Run `npm run build` first; this script packages the compiled `dist` output.
 */

const MCPB_CLI = '@anthropic-ai/mcpb@2.1.2';
const MANIFEST_VERSION = '0.3';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGING = path.join(ROOT, 'build', 'mcpb');
const SERVER_DIR = path.join(STAGING, 'server');
const ENTRY_MODULE = '@olano/mcp-singapore/dist/cli.js';

const rootManifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const { version } = rootManifest;

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
}

function readPackage(directory) {
  return JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
}

/** Walks the dependency graph from the aggregate server so the bundle carries nothing spare. */
function collectDependencies() {
  const workspaceDirectories = new Map();
  for (const entry of [
    'analytics',
    'catalog',
    'core',
    'datagov',
    'finance',
    'insights',
    'lta',
    'onemap',
    'rail',
    'singapore',
    'weather',
  ]) {
    const directory = path.join(ROOT, 'packages', entry);
    workspaceDirectories.set(readPackage(directory).name, directory);
  }

  const olano = new Map();
  const external = new Map();
  const queue = ['@olano/mcp-singapore'];

  while (queue.length > 0) {
    const name = queue.shift();
    if (olano.has(name)) continue;
    const directory = workspaceDirectories.get(name);
    if (!directory) throw new Error(`No workspace directory for ${name}`);
    const manifest = readPackage(directory);
    olano.set(name, { directory, manifest });

    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (dependency.startsWith('@olano/')) {
        queue.push(dependency);
        continue;
      }
      const installed = path.join(ROOT, 'node_modules', dependency);
      if (!existsSync(installed)) {
        throw new Error(`${dependency} is not installed. Run npm ci before building the bundle.`);
      }
      external.set(dependency, readPackage(installed).version);
    }
  }

  return { olano, external };
}

async function describeTools() {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createSingaporeServer();
  const client = new Client({ name: 'olano-mcpb-build', version });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const { tools } = await client.listTools();
    return tools
      .map(({ name, description }) => ({
        name,
        ...(description ? { description: description.split('\n')[0].trim() } : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } finally {
    await client.close();
    await server.close();
  }
}

/** Keeps the declared runtime in step with the engines field the packages actually publish. */
function nodeRequirement() {
  const { engines } = readPackage(path.join(ROOT, 'packages', 'singapore'));
  const declared = engines?.node;
  if (!declared) throw new Error('packages/singapore must declare engines.node.');
  return declared;
}

function buildManifest(tools) {
  return {
    manifest_version: MANIFEST_VERSION,
    name: 'olano-singapore',
    display_name: 'Singapore MCP by Olano',
    version,
    description:
      'Ask about Singapore property, MRT/LRT, buses, companies, weather, the economy, public services, and official financial reference data.',
    long_description:
      'Singapore MCP gives Claude read-only access to official Singapore public data from data.gov.sg, OneMap, LTA DataMall, and SingStat. Every answer keeps its source agency, dataset identifier, observation period, units, and freshness caveats. Most tools work with no credentials at all; OneMap and LTA DataMall tools return an explicit missing-credential error until you add their free keys below. Singapore MCP is an independent community project, not affiliated with or endorsed by the Singapore Government.',
    author: { name: 'Olano', url: 'https://olano.ai' },
    repository: { type: 'git', url: 'https://github.com/olano-ai/mcp-singapore' },
    homepage: 'https://github.com/olano-ai/mcp-singapore#readme',
    documentation: 'https://github.com/olano-ai/mcp-singapore/blob/main/docs/claude-desktop.md',
    support: 'https://github.com/olano-ai/mcp-singapore/issues',
    icon: 'icon.png',
    license: 'MIT',
    keywords: ['singapore', 'mcp', 'public-data', 'research', 'property', 'transport', 'economy'],
    privacy_policies: ['https://github.com/olano-ai/mcp-singapore/blob/main/PRIVACY.md'],
    server: {
      type: 'node',
      entry_point: `server/node_modules/${ENTRY_MODULE}`,
      mcp_config: {
        command: 'node',
        args: [`\${__dirname}/server/node_modules/${ENTRY_MODULE}`],
        env: {
          DATA_GOV_SG_API_KEY: '${user_config.data_gov_sg_api_key}',
          ONEMAP_TOKEN: '${user_config.onemap_token}',
          LTA_DATAMALL_API_KEY: '${user_config.lta_datamall_api_key}',
          OLANO_SG_CACHE_DIR: '${user_config.cache_directory}',
        },
      },
    },
    user_config: {
      data_gov_sg_api_key: {
        type: 'string',
        title: 'data.gov.sg API key (optional)',
        description:
          'Raises provider limits on data.gov.sg datasets. Every data.gov.sg tool also works without it.',
        sensitive: true,
        required: false,
      },
      onemap_token: {
        type: 'string',
        title: 'OneMap token (optional)',
        description:
          'Free token from onemap.gov.sg. Required only by address search, reverse geocoding, routing, and rail address lookup.',
        sensitive: true,
        required: false,
      },
      lta_datamall_api_key: {
        type: 'string',
        title: 'LTA DataMall account key (optional)',
        description:
          'Free key from datamall.lta.gov.sg. Required only by live bus arrivals, traffic, carpark, and taxi tools.',
        sensitive: true,
        required: false,
      },
      cache_directory: {
        type: 'directory',
        title: 'Response cache folder (optional)',
        description:
          'Stores eligible public responses between restarts so repeated questions answer faster. Leave empty to cache in memory only.',
        required: false,
      },
    },
    tools,
    tools_generated: false,
    prompts_generated: true,
    compatibility: {
      // No claude_desktop floor: any build that can read an .mcpb can run this bundle, and a
      // guessed minimum would only lock out working versions.
      platforms: ['darwin', 'win32', 'linux'],
      runtimes: { node: nodeRequirement() },
    },
  };
}

function stageServer({ olano, external }) {
  rmSync(STAGING, { recursive: true, force: true });
  mkdirSync(SERVER_DIR, { recursive: true });

  const dependencies = Object.fromEntries(
    [...external]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, resolved]) => [name, resolved]),
  );
  writeFileSync(
    path.join(SERVER_DIR, 'package.json'),
    `${JSON.stringify({ name: 'olano-singapore-mcpb-server', version, private: true, type: 'module', dependencies }, null, 2)}\n`,
  );

  // Install third-party dependencies first: npm prunes anything it does not know about.
  run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts'], SERVER_DIR);
  rmSync(path.join(SERVER_DIR, 'package-lock.json'), { force: true });

  for (const [name, { directory }] of olano) {
    const target = path.join(SERVER_DIR, 'node_modules', ...name.split('/'));
    mkdirSync(target, { recursive: true });
    const dist = path.join(directory, 'dist');
    if (!existsSync(dist)) {
      throw new Error(`${name} is not built. Run npm run build before building the bundle.`);
    }
    cpSync(dist, path.join(target, 'dist'), { recursive: true });
    cpSync(path.join(directory, 'package.json'), path.join(target, 'package.json'));
    const license = path.join(directory, 'LICENSE');
    if (existsSync(license)) cpSync(license, path.join(target, 'LICENSE'));
  }
}

function stageMetadata(manifest) {
  writeFileSync(path.join(STAGING, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(path.join(STAGING, 'icon.png'), renderOlanoIcon(512));
  cpSync(path.join(ROOT, 'LICENSE'), path.join(STAGING, 'LICENSE'));
  cpSync(path.join(ROOT, 'PRIVACY.md'), path.join(STAGING, 'PRIVACY.md'));
  writeFileSync(
    path.join(STAGING, 'README.md'),
    [
      '# Singapore MCP by Olano',
      '',
      'This folder is the packed source of the Claude Desktop bundle. Install the `.mcpb` file, not',
      'this folder. Documentation, source, and issues:',
      'https://github.com/olano-ai/mcp-singapore',
      '',
    ].join('\n'),
  );
}

const graph = collectDependencies();
stageServer(graph);
const tools = await describeTools();
stageMetadata(buildManifest(tools));

const output = path.join(ROOT, 'build', `olano-singapore-${version}.mcpb`);
rmSync(output, { force: true });
run(
  'npm',
  ['exec', '--yes', `--package=${MCPB_CLI}`, '--', 'mcpb', 'validate', 'manifest.json'],
  STAGING,
);
run('npm', ['exec', '--yes', `--package=${MCPB_CLI}`, '--', 'mcpb', 'pack', STAGING, output], ROOT);

const bundled = [...graph.olano.keys()].length;
const megabytes = (readFileSync(output).length / 1024 / 1024).toFixed(2);
process.stdout.write(
  `Built ${path.relative(ROOT, output)} (${megabytes} MB): ${bundled} Olano packages, ` +
    `${graph.external.size} third-party dependencies, ${tools.length} tools.\n`,
);
