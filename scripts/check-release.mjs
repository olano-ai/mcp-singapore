import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const root = JSON.parse(await readFile('package.json', 'utf8'));
const releaseTag = process.env.RELEASE_TAG;
const expectedTag = `v${root.version}`;

if (releaseTag !== expectedTag) {
  throw new Error(`Release tag must be ${expectedTag}; received ${releaseTag ?? 'nothing'}`);
}

const packageDirectories = await readdir('packages', { withFileTypes: true });
const expectedRepository = 'git+https://github.com/olano-ai/mcp-singapore.git';

for (const directory of packageDirectories) {
  if (!directory.isDirectory()) continue;

  const manifestPath = join('packages', directory.name, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  if (!manifest.name?.startsWith('@olano/')) {
    throw new Error(`${manifestPath}: package name must use the @olano scope`);
  }

  if (manifest.version !== root.version) {
    throw new Error(
      `${manifestPath}: version ${manifest.version} does not match ${root.version}`,
    );
  }

  if (manifest.repository?.url !== expectedRepository) {
    throw new Error(`${manifestPath}: repository URL must be ${expectedRepository}`);
  }
}

process.stdout.write(`Validated ${expectedTag} for all @olano packages.\n`);
