import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { lockupSvg, markSvg } from './olano-mark.mjs';

/**
 * Writes the Olano mark to every plugin's assets directory.
 *
 * All seven plugins ship the same file, and the Codex manifests reference it as `composerIcon` and
 * `logo`. Generating it here keeps them identical to each other and to the PNG that
 * `build-mcpb.mjs` renders for Claude Desktop, all from `olano-mark.mjs`.
 *
 * It also writes the horizontal lockup used as the README header, so the wordmark and the icon
 * stay in step.
 *
 * Pass --check to verify the committed files match without writing, which is what CI runs.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSET_NAME = 'olano-singapore.svg';
const check = process.argv.includes('--check');

const svg = markSvg();
const pluginAssets = readdirSync(path.join(ROOT, 'plugins'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(ROOT, 'plugins', entry.name, 'assets', ASSET_NAME));

if (pluginAssets.length === 0) throw new Error('No plugin directories found under plugins/.');

const generated = [
  ...pluginAssets.map((target) => [target, svg]),
  [path.join(ROOT, 'assets', 'olano-lockup.svg'), lockupSvg()],
];

const stale = [];
for (const [target, contents] of generated) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current === contents) continue;
  stale.push(path.relative(ROOT, target));
  if (check) continue;
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

if (check && stale.length > 0) {
  throw new Error(
    `These brand assets are out of date. Run npm run build:brand:\n  ${stale.join('\n  ')}`,
  );
}

process.stdout.write(
  check
    ? `Brand assets are current: ${pluginAssets.length} plugin icons and the README lockup.\n`
    : `Wrote ${generated.length} brand assets (${stale.length} changed).\n`,
);
