#!/usr/bin/env node
import { runServer } from '@olano/mcp-core';
import { createDataGovServer } from './index.js';

runServer(createDataGovServer).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
