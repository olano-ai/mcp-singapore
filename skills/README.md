# Olano Singapore Agent Skills

Three reusable workflows help agents use `@olano/mcp-singapore` consistently. They are plain
`SKILL.md` packages for clients and coding agents that support the Agent Skills convention.

> The skills use an independent community MCP maintained by Olano. They do not make the MCP, its
> answers, or the skills official or government-endorsed.

## Included skills

| Skill                         | Use it for                                                                                                   | Core behavior                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `research-singapore`          | Locations, mobility, weather, economy, population, health, education, tourism, property, and public services | Selects the smallest relevant tools, checks freshness, preserves units and periods, and attributes the publishing agency                               |
| `analyze-singapore-property`  | HDB/private-property transactions, neighbourhood context, transport, amenities, and mortgage scenarios       | Separates observed transactions from calculations, explains comparability, and keeps estimates distinct from valuations or approvals                   |
| `research-singapore-business` | ACRA/UEN discovery, formations and cessations, sectors, labour, inflation, FX, retail, tourism, and trade    | Resolves entity uncertainty first, separates company facts from market context, and avoids unsupported ownership, solvency, licensing, or trust claims |

## Prerequisite

Configure the aggregate MCP server in the client that will run the skill:

```json
{
  "mcpServers": {
    "singapore": {
      "command": "npx",
      "args": ["-y", "@olano/mcp-singapore"]
    }
  }
}
```

Add only the credentials needed by your work:

- `DATA_GOV_SG_API_KEY` for optional data.gov.sg production access;
- `ONEMAP_TOKEN` for OneMap and address-based rail lookup; and
- `LTA_DATAMALL_API_KEY` for live LTA DataMall tools.

The skills should still report missing credentials explicitly rather than inventing the unavailable
result.

## Install

Copy the complete selected directory—not only its Markdown body—into the Agent Skills directory
used by your client. For a client that uses a local `skills/` directory:

```bash
cp -R skills/research-singapore /path/to/client/skills/
cp -R skills/analyze-singapore-property /path/to/client/skills/
cp -R skills/research-singapore-business /path/to/client/skills/
```

The destination is client-specific. Follow that client's instructions for discovery, validation,
and enabling. No skill is required to run the MCP server or CLI.

## Example requests

### `research-singapore`

- “Research current transport and weather context around Paya Lebar, with source timestamps.”
- “Compare Singapore CPI and retail-sales changes over matched monthly periods.”
- “Find official hawker-centre and childcare records for this area.”

### `analyze-singapore-property`

- “Analyse recent 4-room HDB resale transactions in Bedok and explain comparability limits.”
- “Build a private-property area brief with OneMap and nearby rail context.”
- “Use the official reference-rate series, then stress-test a mortgage at three user-supplied rates.”

### `research-singapore-business`

- “Verify this UEN in the public ACRA shards and add relevant sector context.”
- “Compare formations and cessations for two industries over matched months.”
- “Research labour, inflation, exchange-rate, retail, tourism, and trade context for this sector.”

## Expected output discipline

The packaged workflows instruct agents to:

- distinguish live, snapshot, historical, and frozen data;
- cite the source agency, dataset/table identifier, retrieval date, period, and unit;
- retrieve bounded evidence before calculating;
- align periods and units before comparing series;
- label derived values and assumptions;
- avoid treating correlation as causation; and
- avoid presenting property, finance, crime, company, or area data as personal advice, a valuation,
  approval, or trust/risk determination.

Mortgage tools use free official reference-rate data and educational calculations. The suite does
not provide live SGX quotes or insurance-premium feeds because no stable free official API with
suitable production and redistribution terms has been verified.
