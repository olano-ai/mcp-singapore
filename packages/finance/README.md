# @olano/mcp-finance-sg

Read-only Singapore mortgage-rate context plus transparent local mortgage calculations.

The rate tools use the free official data.gov.sg dataset for current bank interest rates, including
SORA series. The data describes market reference rates and published banking statistics, not current
lender product offers.

Tools:

- `finance_mortgage_rates_latest`
- `finance_mortgage_rates_history`
- `finance_mortgage_payment`
- `finance_mortgage_stress_test`
- `finance_mortgage_affordability`
- `finance_singapore_data_availability`

Olano does not expose live SGX quotes or insurance premiums because no stable official free API with
appropriate production and redistribution terms has been verified. The availability tool explains
these boundaries and links to the official sources.
