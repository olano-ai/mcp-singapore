# 🇸🇬 Singapore MCP

Open-source Model Context Protocol servers for Singapore public data and services.

Built and maintained in Singapore by [Olano](https://olano.ai).

> This is an independent community project. It is not affiliated with, endorsed by, or an official
> product of the Singapore Government or any government agency.

## Packages

| Package                | Coverage                                   | Credentials      |
| ---------------------- | ------------------------------------------ | ---------------- |
| `@olano/mcp-singapore` | All tools plus cross-agency tools          | Depends on tool  |
| `@olano/mcp-datagov`   | Dataset catalogue, rows, real-time feeds   | Optional API key |
| `@olano/mcp-onemap`    | Address search, reverse geocoding, routing | OneMap token     |
| `@olano/mcp-lta`       | Bus arrivals, traffic, parking, taxis      | DataMall key     |
| `@olano/mcp-weather`   | Forecasts, readings, rainfall, PSI         | Optional API key |

All packages support local stdio and Streamable HTTP transports.

## Quick start

Run the full Singapore suite over stdio:

```bash
npx @olano/mcp-singapore
```

Or run a focused server:

```bash
npx @olano/mcp-onemap
npx @olano/mcp-weather
```

Run the aggregate server over Streamable HTTP:

```bash
npx @olano/mcp-singapore --transport http --host 127.0.0.1 --port 3000
```

The MCP endpoint is `http://127.0.0.1:3000/mcp`. The default bind address is localhost. Put
authentication and TLS in front of any internet-facing deployment.

## Client configuration

Add the aggregate server to a client that accepts the common `mcpServers` JSON format:

```json
{
  "mcpServers": {
    "singapore": {
      "command": "npx",
      "args": ["-y", "@olano/mcp-singapore"],
      "env": {
        "DATA_GOV_SG_API_KEY": "optional-data-gov-key",
        "ONEMAP_TOKEN": "your-onemap-token",
        "LTA_DATAMALL_API_KEY": "optional-lta-account-key"
      }
    }
  }
}
```

Remove unused environment variables. Never commit real credentials.

## Tools

Tool names are namespaced and stable:

- `datagov_list_datasets`, `datagov_get_dataset_metadata`, `datagov_list_dataset_rows`
- `datagov_get_realtime`
- `onemap_search`, `onemap_reverse_geocode`, `onemap_route`
- `lta_bus_arrivals`, `lta_list_bus_stops`, `lta_traffic_incidents`
- `lta_traffic_images`, `lta_carpark_availability`, `lta_taxi_availability`
- `weather_two_hour_forecast`, `weather_twenty_four_hour_forecast`
- `weather_four_day_outlook`, `weather_temperature`, `weather_rainfall`, `weather_air_quality`
- `singapore_location_brief`

The servers are read-only. Inputs are validated with Zod, upstream origins and API paths are fixed
in code, requests have timeouts and response-size limits, transient requests are retried, and GET
responses are cached briefly. Upstream calls are start-rate-limited per provider client to avoid
bursts against public services.

## Credentials

| Variable               | Purpose                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `DATA_GOV_SG_API_KEY`  | Optional data.gov.sg key for higher limits and production support |
| `ONEMAP_TOKEN`         | OneMap bearer token for OneMap API operations                     |
| `LTA_DATAMALL_API_KEY` | LTA DataMall subscriber Account Key                               |

LTA dynamic APIs require registration. OneMap APIs require a OneMap account and token. Public
data.gov.sg real-time endpoints can be tested without a key, but production users should obtain one.

## Data sources and attribution

- [data.gov.sg API guide](https://guide.data.gov.sg/developer-guide/api-overview)
- [OneMap API documentation](https://www.onemap.gov.sg/apidocs/)
- [LTA DataMall](https://datamall.lta.gov.sg/content/datamall/en.html)
- [Meteorological Service Singapore](https://www.weather.gov.sg/)
- [Singapore Open Data Licence](https://data.gov.sg/open-data-licence)

API availability, data accuracy, rate limits, and upstream terms are controlled by their respective
providers. Applications using returned data must comply with the relevant source terms and
attribution requirements.

## Development

```bash
npm install
npm run format:check
npm run lint
npm test
npm run build
```

Use the official MCP Inspector for interactive testing:

```bash
npx @modelcontextprotocol/inspector node packages/singapore/dist/cli.js
```

See [Architecture](docs/architecture.md), [Contributing](CONTRIBUTING.md), and
[Security](SECURITY.md).

## Roadmap

- Focused HDB and URA packages over documented public datasets
- ACRA public company-data discovery, subject to dataset terms and practical pagination
- More cross-agency neighbourhood, mobility, and business-location tools
- Hosted authenticated endpoints and MCP Registry publication
- SingStat interoperability rather than duplicating Singapore Department of Statistics' official MCP

## Licence

Source code is released under the MIT License. Government data remains subject to the licence and
terms published by each source agency.
