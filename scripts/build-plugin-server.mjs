import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as esbuild from 'esbuild';

/**
 * Vendors the aggregate server into every Claude Code plugin as readable source.
 *
 * Anthropic's plugin directory asks a plugin to carry the code it runs, as readable files of at
 * most 256 KB each and 512 in total, started from a path under CLAUDE_PLUGIN_ROOT. A registry
 * launcher (`npx -y @olano/mcp-singapore@<version>`) pins the package but not its dependencies,
 * which resolve at install time, so the reviewer would otherwise have to review the npm package.
 *
 * The files come from this repository's own install: the workspace packages' compiled dist (run
 * `npm run build` first) and the third-party packages at the versions package-lock.json pins, so
 * the output is reproducible and `--check` is stable. esbuild traces exactly which files the stdio
 * entry point loads; those files are copied unchanged, keeping their node_modules layout so Node
 * resolves every import as it does here and each package still finds its own package.json, plus
 * each package's licence. Files over the size limit
 * are split at top-level statements into ES modules that import each other (see `splitModule`),
 * which keeps upstream code byte-for-byte and evaluates it in the original order.
 *
 *   node scripts/build-plugin-server.mjs           write plugins/<name>/server
 *   node scripts/build-plugin-server.mjs --check   fail if any committed copy is stale
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = 'node_modules/@olano/mcp-singapore/dist/cli.js';
const FILE_LIMIT = 256 * 1024;
const PART_TARGET = 200 * 1024;
const COUNT_LIMIT = 512;
const check = process.argv.includes('--check');

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (!existsSync(path.join(ROOT, ENTRY))) {
  fail('The aggregate server is not built. Run `npm ci && npm run build` first.');
}

/**
 * Every file the stdio entry point can load, relative to the repository root. Symlinks are kept as
 * written, so a workspace package appears under node_modules/@olano/<name> (where the vendored copy
 * puts it) rather than under packages/.
 */
async function traceFiles() {
  const result = await esbuild.build({
    absWorkingDir: ROOT,
    preserveSymlinks: true,
    entryPoints: [ENTRY],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    metafile: true,
    logLevel: 'error',
  });
  return Object.keys(result.metafile.inputs)
    .filter((file) => file.startsWith('node_modules/'))
    .sort();
}

/** The package directory (node_modules/<name> or node_modules/@scope/<name>) holding a file. */
function packageDirectory(file) {
  const match = /^(node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(file);
  if (!match) throw new Error(`${file} is not inside a package.`);
  return match[1];
}

function declaredNames(statement) {
  const names = [];
  const collect = (pattern) => {
    if (!pattern) return;
    if (pattern.type === 'Identifier') names.push(pattern.name);
    else if (pattern.type === 'ObjectPattern')
      pattern.properties.forEach((p) => collect(p.type === 'RestElement' ? p.argument : p.value));
    else if (pattern.type === 'ArrayPattern') pattern.elements.forEach(collect);
    else if (pattern.type === 'RestElement') collect(pattern.argument);
    else if (pattern.type === 'AssignmentPattern') collect(pattern.left);
  };
  if (statement.type === 'VariableDeclaration')
    statement.declarations.forEach((d) => collect(d.id));
  if (statement.type === 'FunctionDeclaration' || statement.type === 'ClassDeclaration') {
    collect(statement.id);
  }
  return names;
}

/**
 * Splits an ES module that is over the size limit into parts that import each other.
 *
 * The original file name stays the entry (other modules import it by that name) and holds only the
 * imports and the original export list. Each part imports the part before it first, so a depth-first module
 * evaluation reaches part 1 before anything else and runs the parts in source order; every other
 * cross-part reference is a back-edge to a module already on the stack, which ES modules resolve
 * through live bindings. Function declarations are initialised when the cycle links, var bindings
 * read undefined until assigned, and let/const/class stay in their temporal dead zone: the same
 * semantics the single file had. Anything outside the shapes below is refused, not guessed at.
 */
function splitModule(source, baseName) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const allowed = new Set([
    'ImportDeclaration',
    'VariableDeclaration',
    'FunctionDeclaration',
    'ClassDeclaration',
    'ExpressionStatement',
    'ForOfStatement',
    'ForStatement',
    'ForInStatement',
    'IfStatement',
    'BlockStatement',
  ]);
  const imports = [];
  const exportsStatements = [];
  const body = [];
  for (const statement of ast.body) {
    if (statement.type === 'ImportDeclaration') imports.push(statement);
    else if (
      statement.type === 'ExportNamedDeclaration' &&
      !statement.source &&
      !statement.declaration
    ) {
      exportsStatements.push(statement);
    } else if (allowed.has(statement.type)) body.push(statement);
    else throw new Error(`${baseName}: cannot split a top-level ${statement.type}.`);
  }
  if (source.includes('import.meta')) throw new Error(`${baseName}: uses import.meta.`);
  // A var nested in a top-level loop or block is module-scoped but not a top-level declaration, so
  // the parts could not share it. None of the split files has one; refuse rather than mis-split.
  for (const statement of body) {
    if (
      !/Declaration$/.test(statement.type) &&
      /\bvar\b/.test(source.slice(statement.start, statement.end))
    ) {
      throw new Error(`${baseName}: a nested var in a top-level ${statement.type}.`);
    }
  }

  // Group statements by their span in the file (comments between statements count), so each part
  // stays near PART_TARGET and well under FILE_LIMIT once its import lines are added.
  const groups = [];
  let current = [];
  let groupStart = 0;
  for (const statement of body) {
    if (current.length > 0 && statement.end - groupStart > PART_TARGET) {
      groups.push(current);
      current = [];
      groupStart = statement.start;
    }
    current.push(statement);
  }
  if (current.length > 0) groups.push(current);
  if (groups.length < 2) return [[baseName, source]];

  const stem = baseName.replace(/\.(m?js)$/, '');
  const extension = baseName.slice(stem.length);
  const fileOf = (index) => `${stem}.part${index + 1}${extension}`;
  const namesOf = groups.map((group) => group.flatMap(declaredNames));
  const importText = imports.map((s) => source.slice(s.start, s.end)).join('\n');
  const cut = [...imports, ...exportsStatements];
  const header = (what) =>
    `// ${what} of ${baseName}, split unchanged at top-level statements to stay under ${FILE_LIMIT / 1024} KB (scripts/build-plugin-server.mjs).`;
  // Imports every other part's declarations, `first` before the rest.
  const internalImports = (first, self) =>
    [first, ...groups.keys()]
      .filter(
        (other, position, list) => other >= 0 && other !== self && list.indexOf(other) === position,
      )
      .map((other) =>
        namesOf[other].length > 0
          ? `import { ${namesOf[other].join(', ')} } from "./${fileOf(other)}";`
          : `import "./${fileOf(other)}";`,
      );

  const parts = groups.map((group, index) => {
    // Each part runs from its first statement (the file start for part 1) to the next part's first
    // statement, so the comments between statements travel with the code after them. Import and
    // export statements are cut out: every part repeats the imports, and the entry file carries
    // the original export list.
    const start = index === 0 ? 0 : group[0].start;
    const end = index === groups.length - 1 ? source.length : groups[index + 1][0].start;
    let text = '';
    let position = start;
    for (const statement of cut.filter((s) => s.start >= start && s.end <= end)) {
      text += source.slice(position, statement.start);
      position = statement.end;
    }
    text += source.slice(position, end);
    const lines = [
      header(`Part ${index + 1} of ${groups.length}`),
      importText,
      ...internalImports(index - 1, index),
      text.trim(),
      namesOf[index].length > 0 ? `export { ${namesOf[index].join(', ')} };` : '',
    ];
    return [fileOf(index), `${lines.filter((line) => line !== '').join('\n')}\n`];
  });
  // The entry keeps the original file name (other modules import it) and only re-exports. It
  // imports the last part first, which reaches part 1 through the chain of first imports.
  const entry = [
    header('Entry'),
    importText,
    ...internalImports(groups.length - 1, -1),
    exportsStatements.map((s) => source.slice(s.start, s.end)).join('\n'),
  ];
  return [...parts, [baseName, `${entry.filter((line) => line !== '').join('\n')}\n`]];
}

/** Writes the vendored server into `target` and returns its relative file list. */
async function buildServer(target) {
  rmSync(target, { recursive: true, force: true });
  const traced = await traceFiles();
  const packages = [...new Set(traced.map(packageDirectory))].sort();
  const extras = packages.flatMap((directory) =>
    readdirSync(path.join(ROOT, directory))
      .filter((name) => name === 'package.json' || /^licen[cs]e(\.md|\.txt)?$/i.test(name))
      .map((name) => `${directory}/${name}`),
  );

  for (const file of [...new Set([...traced, ...extras])].sort()) {
    const from = path.join(ROOT, file);
    const to = path.join(target, file);
    mkdirSync(path.dirname(to), { recursive: true });
    if (statSync(from).size <= FILE_LIMIT) {
      copyFileSync(from, to);
      continue;
    }
    if (!/\.m?js$/.test(file)) throw new Error(`${file} is over the limit and is not a module.`);
    for (const [name, text] of splitModule(readFileSync(from, 'utf8'), path.basename(file))) {
      writeFileSync(path.join(path.dirname(to), name), text);
    }
  }

  const written = listFiles(target);
  if (written.length > COUNT_LIMIT)
    throw new Error(`${written.length} files exceed ${COUNT_LIMIT}.`);
  for (const file of written) {
    const size = statSync(path.join(target, file)).size;
    if (size > FILE_LIMIT) throw new Error(`${file} is ${size} bytes, over ${FILE_LIMIT}.`);
  }
  return written;
}

function listFiles(directory, prefix = '') {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? listFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`],
    )
    .sort();
}

function digest(directory) {
  const hash = createHash('sha256');
  for (const file of listFiles(directory)) {
    hash
      .update(file)
      .update('\0')
      .update(readFileSync(path.join(directory, file)))
      .update('\0');
  }
  return hash.digest('hex');
}

const plugins = readdirSync(path.join(ROOT, 'plugins'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const scratch = path.join(os.tmpdir(), `olano-plugin-server-${process.pid}`);
const files = await buildServer(scratch);
const expected = digest(scratch);
const bytes = files.reduce((sum, file) => sum + statSync(path.join(scratch, file)).size, 0);

const stale = [];
for (const plugin of plugins) {
  const target = path.join(ROOT, 'plugins', plugin, 'server');
  if (check) {
    if (digest(target) !== expected) stale.push(plugin);
    continue;
  }
  rmSync(target, { recursive: true, force: true });
  for (const file of files) {
    mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
    copyFileSync(path.join(scratch, file), path.join(target, file));
  }
}
rmSync(scratch, { recursive: true, force: true });

if (stale.length > 0) {
  fail(
    `Stale vendored server in ${stale.join(', ')}. Run \`npm run build && npm run build:plugin-server\` and commit the result.`,
  );
}
process.stdout.write(
  `${check ? 'Verified' : 'Wrote'} the vendored server in ${plugins.length} plugins: ${files.length} files, ` +
    `${(bytes / 1024).toFixed(0)} KB, largest under ${FILE_LIMIT / 1024} KB.\n`,
);
