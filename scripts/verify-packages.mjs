import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const forbiddenPatterns = [
  /(^|\/)\.env(?:\.|$)/,
  /(^|\/)\.npmrc$/,
  /(^|\/)(?:coverage|src|test|tests)(?:\/|$)/,
  /\.test\./,
  /\.(?:tsbuildinfo|log)$/,
];

const npmCache = join(tmpdir(), 'olano-npm-pack-cache');

const directories = await readdir('packages', { withFileTypes: true });
let verified = 0;

for (const directory of directories) {
  if (!directory.isDirectory()) continue;

  const manifestPath = join('packages', directory.name, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const output = execFileSync(
    'npm',
    [
      'pack',
      '--dry-run',
      '--json',
      '--ignore-scripts',
      '--offline',
      '--cache',
      npmCache,
      '--workspace',
      manifest.name,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const [pack] = JSON.parse(output);

  if (pack.name !== manifest.name || pack.version !== manifest.version) {
    throw new Error(`${manifest.name}: npm pack metadata does not match package.json`);
  }

  const files = (pack.files ?? []).map(({ path }) => path);
  if (!files.includes('package.json')) {
    throw new Error(`${manifest.name}: dry-run pack does not include package.json`);
  }
  if (!files.some((path) => path.startsWith('dist/'))) {
    throw new Error(`${manifest.name}: dry-run pack does not contain built dist files`);
  }
  if (!files.includes('LICENSE')) {
    throw new Error(`${manifest.name}: dry-run pack does not include LICENSE`);
  }
  if (!files.includes('README.md')) {
    throw new Error(`${manifest.name}: dry-run pack does not include README.md`);
  }

  const forbidden = files.find((path) => forbiddenPatterns.some((pattern) => pattern.test(path)));
  if (forbidden) {
    throw new Error(`${manifest.name}: dry-run pack contains forbidden file ${forbidden}`);
  }

  for (const target of Object.values(manifest.bin ?? {})) {
    if (!files.includes(target)) {
      throw new Error(`${manifest.name}: bin target ${target} is missing from the package`);
    }
  }

  for (const target of Object.values(manifest.exports ?? {})) {
    const candidates = typeof target === 'string' ? [target] : Object.values(target);
    for (const candidate of candidates) {
      const normalized = String(candidate).replace(/^\.\//, '');
      if (!files.includes(normalized)) {
        throw new Error(`${manifest.name}: export target ${candidate} is missing from the package`);
      }
    }
  }

  process.stdout.write(
    `${manifest.name}@${manifest.version}: ${files.length} files, ${pack.size} packed bytes\n`,
  );
  verified += 1;
}

process.stdout.write(`Verified dry-run package contents for ${verified} workspaces.\n`);
