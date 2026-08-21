import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * Enforces the properties that keep a public repository's Actions safe.
 *
 * This repository is open source, so anyone can open a pull request and have CI run their code on
 * our runners. Four properties are what keep that from mattering, and each one is easy to lose in a
 * single careless edit months from now. Checking them in CI means a change that gives away secrets
 * fails the pull request that introduces it.
 *
 *   1. No pull_request_target or workflow_run trigger. Both run in the context of the base
 *      repository with full secret access while checking out a fork's code, which is the standard
 *      way public repositories leak publishing tokens. A plain pull_request trigger, which is what
 *      this repository uses, gets a read-only token and no secrets.
 *   2. Every action pinned to a full commit SHA. A tag is mutable: whoever controls the action's
 *      repository can repoint v4 at anything, and it runs with our token.
 *   3. Every workflow declares its own permissions. Without one, the job inherits whatever the
 *      repository default is, which may be write.
 *   4. No expression interpolated into a run: body. `${{ github.event.pull_request.title }}` inside
 *      a shell script is a command injection an outsider controls; the same value passed through
 *      env: is inert.
 *
 * Also verifies that no workflow reachable from a fork pull request references a secret at all.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const FORBIDDEN_TRIGGERS = ['pull_request_target', 'workflow_run'];
const problems = [];

function report(file, line, message) {
  problems.push(`${path.join('.github/workflows', file)}${line ? `:${line}` : ''} — ${message}`);
}

/** Line ranges of every `run:` script body, so expressions inside them can be told apart. */
function runBodyLines(lines) {
  const inside = new Set();
  let blockIndent = null;

  lines.forEach((line, index) => {
    if (blockIndent !== null) {
      if (line.trim() === '') return;
      if (line.search(/\S/) > blockIndent) {
        inside.add(index);
        return;
      }
      blockIndent = null;
    }

    const match = /^(\s*)-?\s*run:\s*(\|[-+]?|>[-+]?)?\s*(.*)$/.exec(line);
    if (!match) return;
    if (match[2]) blockIndent = match[1].length;
    else if (match[3].trim()) inside.add(index);
  });

  return inside;
}

const files = readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name));
if (files.length === 0) throw new Error('No workflows found under .github/workflows.');

for (const file of files) {
  const source = readFileSync(path.join(WORKFLOWS, file), 'utf8');
  const lines = source.split('\n');
  const runLines = runBodyLines(lines);

  if (!/^permissions:/m.test(source)) {
    report(file, null, 'no top-level permissions block; it inherits the repository default');
  }

  const triggersFork = /^\s{2}pull_request:/m.test(source);
  lines.forEach((line, index) => {
    const number = index + 1;

    for (const trigger of FORBIDDEN_TRIGGERS) {
      if (new RegExp(`^\\s{2}${trigger}:`).test(line)) {
        report(file, number, `${trigger} runs fork code with secrets; use pull_request instead`);
      }
    }

    const uses = /^\s*-?\s*uses:\s*(\S+)/.exec(line);
    if (uses && !uses[1].startsWith('./') && !/@[0-9a-f]{40}$/.test(uses[1])) {
      report(file, number, `${uses[1]} is not pinned to a full commit SHA`);
    }

    if (runLines.has(index) && /\$\{\{/.test(line)) {
      report(
        file,
        number,
        'expression interpolated into a run: body; pass it through env: instead',
      );
    }

    if (triggersFork && /\bsecrets\./.test(line) && !/^\s*#/.test(line)) {
      report(file, number, 'references a secret in a workflow that fork pull requests can trigger');
    }
  });
}

if (problems.length > 0) {
  process.stderr.write(`Workflow security check failed:\n  ${problems.join('\n  ')}\n`);
  process.exit(1);
}

process.stdout.write(
  `Verified ${files.length} workflows: no fork-privileged triggers, every action pinned to a SHA, ` +
    `permissions declared, no expressions in run bodies.\n`,
);
