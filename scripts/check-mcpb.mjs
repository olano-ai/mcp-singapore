import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { fileURLToPath } from 'node:url';

/**
 * Verifies the packed Claude Desktop bundle the way Claude Desktop uses it.
 *
 * The bundle is unpacked outside the repository and started with the exact command, arguments, and
 * environment its own manifest declares, so a dependency that only resolves through the monorepo's
 * node_modules fails here instead of on a user's machine. Optional credentials are left blank to
 * prove a no-credential install still starts.
 *
 * Run `npm run build:mcpb` first.
 */

const MCPB_CLI = '@anthropic-ai/mcpb@2.1.2';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const BUNDLE = path.join(ROOT, 'build', `olano-singapore-${version}.mcpb`);
const REQUEST_TIMEOUT_MS = 60000;

if (!existsSync(BUNDLE)) {
  throw new Error(`${path.relative(ROOT, BUNDLE)} is missing. Run npm run build:mcpb first.`);
}

const workspace = mkdtempSync(path.join(tmpdir(), 'olano-mcpb-'));

function connect(directory) {
  const manifest = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  const { command, args, env } = manifest.server.mcp_config;

  const child = spawn(
    command,
    args.map((argument) => argument.replaceAll('${__dirname}', directory)),
    {
      // A user's home directory is not the repository: nothing may resolve through it.
      cwd: tmpdir(),
      // Optional user_config left empty, exactly as an install with no credentials entered.
      env: { ...process.env, ...Object.fromEntries(Object.keys(env).map((key) => [key, ''])) },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );

  let stderr = '';
  child.stderr.on('data', (chunk) => (stderr += chunk));

  const pending = new Map();
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      const settle = pending.get(message.id);
      if (!settle) continue;
      pending.delete(message.id);
      settle(message);
    }
  });

  let nextId = 1;
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(
        () => reject(new Error(`${method} timed out after ${REQUEST_TIMEOUT_MS}ms.\n${stderr}`)),
        REQUEST_TIMEOUT_MS,
      );
      pending.set(id, (message) => {
        clearTimeout(timer);
        if (message.error) reject(new Error(`${method} failed: ${message.error.message}`));
        else resolve(message.result);
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });

  const notify = (method) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
  return { manifest, child, request, notify };
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

execFileSync(
  'npm',
  ['exec', '--yes', `--package=${MCPB_CLI}`, '--', 'mcpb', 'unpack', BUNDLE, workspace],
  {
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);

const { manifest, child, request, notify } = connect(workspace);

try {
  expect(
    manifest.version === version,
    `Bundle version ${manifest.version} does not match ${version}.`,
  );
  expect(
    existsSync(path.join(workspace, manifest.icon)),
    `Bundle icon ${manifest.icon} is missing.`,
  );
  expect(
    existsSync(path.join(workspace, manifest.server.entry_point)),
    `Bundle entry point ${manifest.server.entry_point} is missing.`,
  );

  const initialize = await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'olano-mcpb-check', version },
  });
  expect(
    initialize.serverInfo.version === version,
    `Server reported version ${initialize.serverInfo.version}; expected ${version}.`,
  );
  notify('notifications/initialized');

  const { tools } = await request('tools/list', {});
  expect(
    tools.length === manifest.tools.length,
    `Server exposes ${tools.length} tools; the manifest declares ${manifest.tools.length}.`,
  );

  const declared = new Set(manifest.tools.map(({ name }) => name));
  const undeclared = tools.map(({ name }) => name).filter((name) => !declared.has(name));
  expect(undeclared.length === 0, `Tools missing from the manifest: ${undeclared.join(', ')}`);

  const { prompts } = await request('prompts/list', {});
  expect(prompts.length > 0, 'Bundle exposes no MCP prompts.');
  const { resources } = await request('resources/list', {});
  expect(resources.length > 0, 'Bundle exposes no MCP resources.');

  // Answers from data bundled in the package: no credential and no network involved.
  const rail = await request('tools/call', {
    name: 'rail_list_stations_by_line',
    arguments: { line: 'Thomson-East Coast Line' },
  });
  expect(rail.isError !== true, `rail_list_stations_by_line failed: ${rail.content[0].text}`);
  const stations = JSON.parse(rail.content[0].text);
  expect(
    stations.results.length > 20,
    `Expected the full Thomson-East Coast Line station list, got ${stations.results.length}.`,
  );

  // A blank optional credential must produce an explicit error, not a crash or a fabricated answer.
  const lta = await request('tools/call', {
    name: 'lta_bus_arrivals',
    arguments: { busStopCode: '83139' },
  });
  expect(
    lta.content[0].text.includes('LTA_DATAMALL_API_KEY'),
    `Expected a missing-credential error, got: ${lta.content[0].text.slice(0, 200)}`,
  );

  process.stdout.write(
    `Verified ${path.basename(BUNDLE)}: ${tools.length} tools, ${prompts.length} prompts, ` +
      `${resources.length} resources, starts with no credentials.\n`,
  );
} finally {
  child.kill();
  rmSync(workspace, { recursive: true, force: true });
}
