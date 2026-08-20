# @olano/mcp-insights-sg

Semantic and deterministic insight tools for the Olano Singapore MCP suite.

This package adds prompt discovery, a non-executing natural-language router,
period-aware cross-series comparison, rich text/chart-ready visualisation, and
derived insights for HDB resale transactions, COE bidding, CPI, employment,
retail sales, Singapore business formations, GDP industries, recorded crime,
ECDA vacancy labels, and the historical MOH infectious-disease dataset. It also
provides real data.gov.sg catalogue search and true-distance school and
early-childhood proximity through official OneMap themes.

All upstream data tools use documented public data.gov.sg or SingStat APIs.
The package is read-only and returns source identifiers and calculation notes.
OneMap proximity tools require `ONEMAP_TOKEN`; all distance results use official
coordinates and haversine calculations rather than postal-prefix guesses.

The 87-name compatibility registry distinguishes executable canonical tools
from the recommendation-only `sg_ask` router. Historical disease results expose
the frozen 2022 source boundary, and ECDA summaries preserve the published
`Available` / `Limited` / `Full` categories instead of fabricating numeric
vacancy totals.

```ts
import { registerSingaporeInsightTools } from '@olano/mcp-insights-sg';

registerSingaporeInsightTools(server);
```
