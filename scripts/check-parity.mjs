import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { altronisCompatibilityRegistry } from '../packages/insights/dist/index.js';
import { createSingaporeServer } from '../packages/singapore/dist/index.js';

const manifest = JSON.parse(await readFile('docs/altronis-parity.json', 'utf8'));
const capabilities = Object.entries(manifest.capabilities ?? {});
const registry = new Map(
  altronisCompatibilityRegistry.map((item) => [item.compatibility_tool, item]),
);
const recommendationOnlyCapabilities = new Set(['sg_ask']);

if (capabilities.length !== manifest.expected_capability_count) {
  throw new Error(
    `Parity manifest contains ${capabilities.length} capabilities; expected ${manifest.expected_capability_count}.`,
  );
}
if (registry.size !== manifest.expected_capability_count) {
  throw new Error(
    `Runtime compatibility registry contains ${registry.size} capabilities; expected ${manifest.expected_capability_count}.`,
  );
}

const duplicateCompetitorNames = capabilities
  .map(([name]) => name)
  .filter((name, index, all) => all.indexOf(name) !== index);
if (duplicateCompetitorNames.length) {
  throw new Error(`Duplicate competitor capabilities: ${duplicateCompetitorNames.join(', ')}`);
}

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const server = createSingaporeServer();
const client = new Client({ name: 'olano-parity-check', version: '0.2.0' });
await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

try {
  const { tools } = await client.listTools();
  const available = new Set(tools.map(({ name }) => name));
  const missing = [];
  for (const [competitor, equivalents] of capabilities) {
    const mapping = registry.get(competitor);
    if (!mapping) {
      missing.push(`${competitor}: absent from runtime capability registry`);
      continue;
    }
    if (!Array.isArray(equivalents) || equivalents.length === 0) {
      missing.push(`${competitor}: no exact compatibility entry point`);
      continue;
    }
    if (!equivalents.includes(competitor)) {
      missing.push(`${competitor}: manifest must include the exact compatibility entry point`);
    }
    for (const equivalent of equivalents) {
      if (!available.has(equivalent)) missing.push(`${competitor}: missing ${equivalent}`);
    }
    if (!available.has(mapping.olano_tool)) {
      missing.push(`${competitor}: canonical implementation ${mapping.olano_tool} is unavailable`);
    }
    if (!mapping.olano_tool || mapping.olano_tool.startsWith('sg_')) {
      missing.push(`${competitor}: canonical mapping must name a non-compatibility Olano tool`);
    }
    if (mapping.retrieval === 'route_only' && !recommendationOnlyCapabilities.has(competitor)) {
      missing.push(
        `${competitor}: canonical mapping ${mapping.olano_tool} is route-only, not executable`,
      );
    }
  }

  if (missing.length) {
    throw new Error(`Altronis parity contract failed:\n- ${missing.join('\n- ')}`);
  }

  process.stdout.write(
    `Verified ${capabilities.length} audited Altronis entry points, canonical executable mappings, and ${available.size} aggregate Olano tools.\n`,
  );
} finally {
  await client.close();
  await server.close();
}
