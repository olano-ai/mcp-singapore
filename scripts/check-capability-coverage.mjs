import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { capabilityCoverageRegistry } from '../packages/insights/dist/index.js';
import { createSingaporeServer } from '../packages/singapore/dist/index.js';

const manifest = JSON.parse(await readFile('docs/capability-coverage.json', 'utf8'));
const capabilities = Object.entries(manifest.capabilities ?? {});
const registry = new Map(capabilityCoverageRegistry.map((item) => [item.compatibility_tool, item]));
const recommendationOnlyCapabilities = new Set(['sg_ask']);

if (capabilities.length !== manifest.expected_capability_count) {
  throw new Error(
    `Coverage manifest contains ${capabilities.length} capabilities; expected ${manifest.expected_capability_count}.`,
  );
}
if (registry.size !== manifest.expected_capability_count) {
  throw new Error(
    `Runtime compatibility registry contains ${registry.size} capabilities; expected ${manifest.expected_capability_count}.`,
  );
}

const duplicateCompatibilityNames = capabilities
  .map(([name]) => name)
  .filter((name, index, all) => all.indexOf(name) !== index);
if (duplicateCompatibilityNames.length) {
  throw new Error(
    `Duplicate compatibility capabilities: ${duplicateCompatibilityNames.join(', ')}`,
  );
}

const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const server = createSingaporeServer();
const client = new Client({ name: 'olano-capability-coverage-check', version: '0.3.0' });
await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

try {
  const { tools } = await client.listTools();
  const available = new Set(tools.map(({ name }) => name));
  const missing = [];
  for (const [compatibilityName, equivalents] of capabilities) {
    const mapping = registry.get(compatibilityName);
    if (!mapping) {
      missing.push(`${compatibilityName}: absent from runtime capability registry`);
      continue;
    }
    if (!Array.isArray(equivalents) || equivalents.length === 0) {
      missing.push(`${compatibilityName}: no exact compatibility entry point`);
      continue;
    }
    if (!equivalents.includes(compatibilityName)) {
      missing.push(
        `${compatibilityName}: manifest must include the exact compatibility entry point`,
      );
    }
    for (const equivalent of equivalents) {
      if (!available.has(equivalent)) missing.push(`${compatibilityName}: missing ${equivalent}`);
    }
    if (!available.has(mapping.olano_tool)) {
      missing.push(
        `${compatibilityName}: canonical implementation ${mapping.olano_tool} is unavailable`,
      );
    }
    if (!mapping.olano_tool || mapping.olano_tool.startsWith('sg_')) {
      missing.push(
        `${compatibilityName}: canonical mapping must name a non-compatibility Olano tool`,
      );
    }
    if (
      mapping.retrieval === 'route_only' &&
      !recommendationOnlyCapabilities.has(compatibilityName)
    ) {
      missing.push(
        `${compatibilityName}: canonical mapping ${mapping.olano_tool} is route-only, not executable`,
      );
    }
  }

  if (missing.length) {
    throw new Error(`Capability coverage contract failed:\n- ${missing.join('\n- ')}`);
  }

  process.stdout.write(
    `Verified ${capabilities.length} compatibility entry points, canonical executable mappings, and ${available.size} aggregate Olano tools.\n`,
  );
} finally {
  await client.close();
  await server.close();
}
