---
name: analyze-singapore-mobility
description: Analyze Singapore MRT, LRT, buses, routes, road traffic, taxis, parking, and COE data with the Olano Singapore MCP suite. Use for station and line research, nearby transport, live arrivals, disruptions, traffic conditions, or vehicle-market context.
---

# Analyze Singapore Mobility

1. Identify the place, station, line, stop, route, travel time, and freshness required.
2. Use `rail_*` for the complete MRT/LRT network, station codes, line order, interchanges, and nearby-station analysis. Resolve addresses with `onemap_*` when coordinates are needed.
3. Use `lta_*` for live bus arrivals, traffic incidents, taxi availability, road conditions, and other DataMall feeds. Report a missing `LTA_DATAMALL_API_KEY` instead of substituting unverified data.
4. Use `coe_*` for bidding results and quota context, and `hdb_carparks_*` for public car-park availability or metadata.
5. Distinguish static network snapshots from live observations. State the source timestamp, retrieval time, units, and any stale or partial-feed warning.
6. Treat straight-line proximity as proximity, not a routed journey. Do not claim accessibility, service reliability, or travel time unless the selected tool measures it.

Use the smallest relevant tool set and preserve station, line, stop, and vehicle-category identifiers exactly.
