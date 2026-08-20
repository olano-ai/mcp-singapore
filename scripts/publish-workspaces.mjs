import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const directories = await readdir('packages', { withFileTypes: true });
const packages = new Map();

for (const directory of directories) {
  if (!directory.isDirectory()) continue;
  const manifest = JSON.parse(
    await readFile(join('packages', directory.name, 'package.json'), 'utf8'),
  );
  packages.set(manifest.name, manifest);
}

const remaining = new Set(packages.keys());
const publishedOrder = [];

while (remaining.size > 0) {
  const ready = [...remaining]
    .filter((name) => {
      const manifest = packages.get(name);
      const internalDependencies = [
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.optionalDependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
      ].filter((dependency) => packages.has(dependency));
      return internalDependencies.every((dependency) => !remaining.has(dependency));
    })
    .sort();

  if (ready.length === 0) {
    throw new Error(`Internal workspace dependency cycle: ${[...remaining].join(', ')}`);
  }

  for (const name of ready) {
    const manifest = packages.get(name);
    const spec = `${name}@${manifest.version}`;
    const view = spawnSync('npm', ['view', spec, 'version', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (view.status === 0) {
      process.stdout.write(`Already published, skipping ${spec}.\n`);
    } else if (!/E404|404 Not Found/i.test(view.stderr ?? '')) {
      throw new Error(
        `Could not determine whether ${spec} is already published: ${(view.stderr ?? '').trim() || `npm exited ${view.status}`}`,
      );
    } else {
      process.stdout.write(`Publishing ${spec}...\n`);
      const publish = spawnSync(
        'npm',
        ['publish', '--workspace', name, '--access', 'public', '--provenance', '--tag', 'latest'],
        { stdio: 'inherit' },
      );
      if (publish.status !== 0) {
        throw new Error(`npm publish failed for ${spec} with exit code ${publish.status}`);
      }
    }

    remaining.delete(name);
    publishedOrder.push(spec);
  }
}

process.stdout.write(`Release order: ${publishedOrder.join(' -> ')}\n`);
