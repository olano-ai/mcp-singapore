---
name: research-singapore
description: Research Singapore locations, mobility, businesses, the economy, population, weather, health, education, tourism, property, or public services using the Olano Singapore MCP suite. Use when a question needs Singapore public data, cross-agency evidence, source attribution, or freshness checks.
---

# Research Singapore

Use the Olano Singapore MCP tools to produce evidence-backed answers from authoritative public data. Treat the suite as an independent community project, not a government-endorsed service.

## Workflow

1. Define the place, entity, period, and comparison. Ask only when ambiguity materially changes the answer.
2. Call `singapore_catalog_list` when tool selection is unclear, then route to the relevant namespace.
3. Call matching `*_metadata` or `*_freshness` tools before relying on unfamiliar or time-sensitive datasets.
4. Retrieve the smallest useful sample. Preserve fields and units.
5. Use `analytics_*` only after aligning periods and units. Never turn correlation into causation.
6. State the observation period, source agency, identifier, and limitations.

Never call these “official Singapore MCPs.” Attribute government data to its source agency. Keep finance outputs factual and educational.
