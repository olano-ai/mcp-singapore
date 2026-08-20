#!/usr/bin/env node
import { runServer } from '@olano/mcp-core';
import { createWeatherServer } from './index.js';

runServer(createWeatherServer).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
