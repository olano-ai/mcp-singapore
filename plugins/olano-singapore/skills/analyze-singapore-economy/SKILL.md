---
name: analyze-singapore-economy
description: Analyze Singapore GDP, inflation, employment, unemployment, income, population, retail, trade, tourism, business, exchange-rate, and electricity indicators with the Olano Singapore MCP suite. Use for economic snapshots, trends, and matched-period comparisons.
---

# Analyze Singapore Economy

1. Define the indicator, measure, frequency, period, unit, and comparison before retrieving observations.
2. Use the narrowest matching `gdp_*`, `cpi_*`, `employment_*`, `unemployment_*`, `median_income_*`, `population_*`, `retail_*`, `visitor_*`, `tourism_*`, `business_*`, `singstat_*`, `mas_fx_*`, or `electricity_*` tool.
3. Check metadata and freshness. Preserve seasonal-adjustment status, price basis, index base, currency, frequency, and source table identifiers.
4. Align periods and units before calling `analytics_*`. Label growth rates, rolling calculations, rebasing, and other derived values.
5. Separate released observations from interpretation. Do not manufacture forecasts, bridge incompatible series, or imply causation from correlation.
6. Report revisions, missing periods, partial coverage, and frozen datasets when the tool exposes them.

Attribute each series to its publishing agency and state the observation period separately from the retrieval date.
