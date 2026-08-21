import { createRequire } from 'node:module';

/**
 * Reads the version a package publishes under, from the package itself.
 *
 * Every MCP server advertises a version in its `serverInfo`, and hard-coding it there means it
 * silently goes stale the moment a release bumps package.json. Resolving it at construction keeps
 * the advertised version true no matter how the release was cut.
 *
 * Each package compiles `src/*.ts` to `dist/*.js`, so `../package.json` relative to the built
 * module is that package's own manifest. npm always publishes package.json, and the Claude Desktop
 * bundle copies it next to `dist`, so it is present in every layout the servers run from.
 *
 * @param moduleUrl Always `import.meta.url` from the calling module.
 */
export function packageVersion(moduleUrl: string): string {
  const { version } = createRequire(moduleUrl)('../package.json') as { version?: string };
  if (!version) throw new Error(`No version field in the package.json next to ${moduleUrl}`);
  return version;
}
