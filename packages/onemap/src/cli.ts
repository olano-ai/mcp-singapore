#!/usr/bin/env node
import { runServer } from '@olano/mcp-core';
import { createOneMapServer } from './index.js';

runServer(createOneMapServer).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
