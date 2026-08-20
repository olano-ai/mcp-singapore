---
name: research-singapore-business
description: Research Singapore companies, UENs, formations, cessations, sectors, retail, tourism, labour, inflation, exchange rates, and optional listed-market context with the Olano Singapore MCP suite. Use for company discovery, market context, sector research, or business-location evidence.
---

# Research Singapore Business

1. Discover the legal name or UEN with `acra_search_entities`, then resolve with `acra_get_entity`.
2. Report exact returned facts and uncertain matches. Never infer ownership, creditworthiness, solvency, licensing, or trustworthiness.
3. Choose relevant `singstat_*`, `retail_sales_*`, `visitor_arrivals_*`, `employment_sector_*`, `gdp_growth_*`, `cpi_*`, `median_income_*`, or `mas_fx_*` context.
4. Check freshness and align periods and units before using `analytics_*`.
5. Do not imply live SGX coverage. Use optional third-party listed-market context only when it is configured, explicitly requested, and clearly attributed.
6. For regulated entities, use `finance_financial_source_directory` and verify with MAS FID.

Separate company facts, market prices, and macro context. State dates, identifiers, derivations, and limits. This is not legal, investment, credit, or compliance advice.
