---
name: analyze-singapore-property
description: Analyze Singapore HDB resale, private property, neighbourhood, transport, amenities, and mortgage scenarios with the Olano Singapore MCP suite. Use for property-area research, comparable transactions, affordability estimates, or mortgage scenario comparisons.
---

# Analyze Singapore Property

1. Identify the property type, place, period, comparable constraints, price, and financing assumptions.
2. Resolve ambiguous locations with `onemap_search`.
3. Check freshness, then use `hdb_resale_*` or `ura_private_property_*`.
4. Explain why transactions are comparable and separate tenure, area, storey, lease, project, and period differences.
5. Add `lta_*`, `hdb_carparks_*`, `schools_*`, or `childcare_*` context only when relevant.
6. Use `finance_mortgage_rates_latest` or `finance_mortgage_rates_history` for official reference-rate context, then `finance_mortgage_payment`, `finance_mortgage_stress_test`, and `finance_mortgage_affordability` for transparent scenarios.

Separate observed transactions from calculations and interpretation. This is not a valuation, offer price, lender approval, regulatory determination, or personal financial advice. Cite current MoneySense or government rules and their check date.
