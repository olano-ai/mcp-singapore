# @olano/sg-cli

Use the Olano Singapore suite without configuring an MCP client.

```bash
npx @olano/sg-cli list
npx @olano/sg-cli search rail
npx @olano/sg-cli ask "Summarise recent 4-room HDB resale prices in Bedok"
npx @olano/sg-cli query "What were the latest COE premiums?"
npx @olano/sg-cli datasets
npx @olano/sg-cli datasets property
npx @olano/sg-cli examples rail
npx @olano/sg-cli prompts
npx @olano/sg-cli profiles
npx @olano/sg-cli profile mobility
npx @olano/sg-cli tool weather_two_hour_forecast '{}'
```

The npm package is `@olano/sg-cli`; the executable is deliberately shorter: `olano-sg`.

`ask` and its `query` alias call the suite's deterministic `sg_ask` router. They return
recommended tools, extracted arguments, confidence and any missing required arguments; they do
not send the question to an external model or execute an arbitrary recommended tool.

`datasets` lists the curated Singapore public-data catalogue, while `examples` prints realistic
queries grouped across locations, rail, mobility, weather, property, business, the economy,
finance, education, health, population, tourism, civic data and cross-series analytics. Use
`examples <category>` to narrow it. `prompts` lists the reusable MCP prompt templates exposed by
the aggregate server.

`profiles` prints the same exported profile definitions used by `@olano/mcp-singapore` itself.
`profile <name>` previews the exact names selected by that server-side prefix contract (including
the always-available profile discovery tool). To run the MCP server with the reduced inventory,
use `npx @olano/mcp-singapore --profile <name>` or set `OLANO_SG_PROFILE`.
