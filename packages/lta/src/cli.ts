#!/usr/bin/env node
import { runServer } from '@olano/mcp-core';
import { createLtaServer } from './index.js';

runServer(createLtaServer).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
