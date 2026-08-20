#!/usr/bin/env node
import { runServer } from '@olano/mcp-core';
import { createSingaporeServer, resolveSingaporeToolProfile } from './index.js';

function readProfileArgument(args: string[]): string | undefined {
  const assignment = args.find((argument) => argument.startsWith('--profile='));
  if (assignment) {
    const value = assignment.slice('--profile='.length);
    if (!value) throw new Error('--profile requires a profile name');
    return value;
  }
  const index = args.indexOf('--profile');
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error('--profile requires a profile name');
  return value;
}

async function main(): Promise<void> {
  const profile = resolveSingaporeToolProfile(
    readProfileArgument(process.argv.slice(2)) ?? process.env.OLANO_SG_PROFILE,
  );
  await runServer(() => createSingaporeServer({ profile }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
