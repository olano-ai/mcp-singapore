#!/usr/bin/env node
import { runServer } from '@olano/mcp-core';
import { createSingaporeServer } from './index.js';

runServer(createSingaporeServer).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
