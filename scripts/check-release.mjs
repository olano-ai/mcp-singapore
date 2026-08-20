import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const root = JSON.parse(await readFile('package.json', 'utf8'));
const rootLicense = await readFile('LICENSE', 'utf8');
const registryManifest = JSON.parse(await readFile('server.json', 'utf8'));
const releaseTag = process.env.RELEASE_TAG;
const expectedTag = `v${root.version}`;
const expectedRepository = 'git+https://github.com/olano-ai/mcp-singapore.git';
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

if (releaseTag !== expectedTag) {
  throw new Error(`Release tag must be ${expectedTag}; received ${releaseTag ?? 'nothing'}`);
}

if (!root.private) {
  throw new Error('The monorepo root must remain private so only workspaces are published.');
}

if (!semverPattern.test(root.version)) {
  throw new Error(`Root version must be a valid release semver; received ${root.version}`);
}

const registryPackage = registryManifest.packages?.find(
  (item) => item.registryType === 'npm' && item.identifier === '@olano/mcp-singapore',
);
if (
  registryManifest.name !== 'io.github.olano-ai/mcp-singapore' ||
  registryManifest.version !== root.version ||
  registryPackage?.version !== root.version ||
  registryPackage?.transport?.type !== 'stdio'
) {
  throw new Error('server.json must describe the current @olano/mcp-singapore stdio release');
}

const packageDirectories = await readdir('packages', { withFileTypes: true });
const packages = [];

for (const directory of packageDirectories) {
  if (!directory.isDirectory()) continue;

  const manifestPath = join('packages', directory.name, 'package.json');
  try {
    await access(manifestPath);
  } catch {
    throw new Error(`${manifestPath}: every packages/* directory must contain a package.json`);
  }
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  packages.push({ directory: directory.name, manifest, manifestPath });
}

if (packages.length === 0) {
  throw new Error('No publishable workspaces were found under packages/*.');
}

const packageNames = new Set(packages.map(({ manifest }) => manifest.name));
if (packageNames.size !== packages.length) {
  throw new Error('Workspace package names must be unique.');
}

for (const { directory, manifest, manifestPath } of packages) {
  if (manifest.private) {
    throw new Error(`${manifestPath}: release workspaces must not be private`);
  }

  if (!manifest.name?.startsWith('@olano/')) {
    throw new Error(`${manifestPath}: package name must use the @olano scope`);
  }

  if (manifest.version !== root.version) {
    throw new Error(`${manifestPath}: version ${manifest.version} does not match ${root.version}`);
  }

  if (manifest.repository?.url !== expectedRepository) {
    throw new Error(`${manifestPath}: repository URL must be ${expectedRepository}`);
  }

  if (manifest.repository?.directory !== `packages/${directory}`) {
    throw new Error(`${manifestPath}: repository.directory must be packages/${directory}`);
  }

  if (manifest.license !== 'MIT') {
    throw new Error(`${manifestPath}: license must be MIT`);
  }

  if (manifest.publishConfig?.access && manifest.publishConfig.access !== 'public') {
    throw new Error(`${manifestPath}: publishConfig.access must be public when specified`);
  }

  if (
    !Array.isArray(manifest.files) ||
    !manifest.files.includes('dist') ||
    !manifest.files.includes('README.md') ||
    !manifest.files.includes('LICENSE')
  ) {
    throw new Error(`${manifestPath}: files must explicitly include dist, README.md, and LICENSE`);
  }

  const packageReadmePath = join('packages', directory, 'README.md');
  const packageReadme = await readFile(packageReadmePath, 'utf8').catch(() => '');
  if (!packageReadme.trim()) {
    throw new Error(`${packageReadmePath}: every public workspace must include a README`);
  }

  const packageLicensePath = join('packages', directory, 'LICENSE');
  let packageLicense;
  try {
    packageLicense = await readFile(packageLicensePath, 'utf8');
  } catch {
    throw new Error(`${packageLicensePath}: every public workspace must include a LICENSE file`);
  }
  if (packageLicense !== rootLicense) {
    throw new Error(`${packageLicensePath}: workspace LICENSE must match the root LICENSE`);
  }

  if (manifest.engines?.node !== '>=20') {
    throw new Error(`${manifestPath}: engines.node must be >=20`);
  }

  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [dependency, version] of Object.entries(manifest[field] ?? {})) {
      if (!dependency.startsWith('@olano/')) continue;
      if (!packageNames.has(dependency)) {
        throw new Error(`${manifestPath}: internal dependency ${dependency} is not a workspace`);
      }
      if (version !== root.version) {
        throw new Error(
          `${manifestPath}: internal dependency ${dependency} must use exact version ${root.version}`,
        );
      }
    }
  }
}

const aggregate = packages.find(({ manifest }) => manifest.name === '@olano/mcp-singapore');
if (aggregate?.manifest.mcpName !== registryManifest.name) {
  throw new Error('The aggregate package mcpName must match server.json name');
}

process.stdout.write(`Validated ${expectedTag} for ${packages.length} public @olano packages.\n`);
