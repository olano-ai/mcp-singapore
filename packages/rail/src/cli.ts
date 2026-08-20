#!/usr/bin/env node
import { runServer } from '@olano/mcp-core';
import { createRailServer } from './index.js';

runServer(createRailServer).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
