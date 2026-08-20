# `@olano/mcp-rail-sg`

Read-only MCP tools for Singapore MRT and LRT stations, station exits, line codes,
interchanges, nearest-location lookup, and historical network counts.

Fourteen tools are offline-first and require no API key. The optional
`rail_nearest_stations_to_address` tool uses live OneMap geocoding and requires
`ONEMAP_TOKEN`. The package bundles normalized snapshots from official LTA and
data.gov.sg sources so its core station queries are fast and deterministic.

## Run

```bash
npx @olano/mcp-rail-sg
```

Streamable HTTP is also supported:

```bash
npx @olano/mcp-rail-sg --transport http --port 3000
```

## Tools

- `rail_source_metadata`
- `rail_network_summary`
- `rail_list_stations`
- `rail_search_stations`
- `rail_get_station`
- `rail_get_station_connections`
- `rail_list_exits`
- `rail_get_station_exits`
- `rail_nearest_stations`
- `rail_nearest_exits`
- `rail_nearest_stations_to_address` (requires `ONEMAP_TOKEN`)
- `rail_list_lines`
- `rail_list_stations_by_line`
- `rail_list_interchanges`
- `rail_historical_station_counts`

## Example questions

- “What are the MRT and LRT codes for Choa Chu Kang?”
- “Find the five nearest rail stations to latitude 1.29027, longitude 103.851959.”
- “Find the nearest MRT stations to 1 Fullerton Road.”
- “Which City Hall exit is nearest to these coordinates?”
- “List every station on the Thomson-East Coast Line.”
- “Show all MRT/LRT interchange complexes.”
- “How did Singapore’s published MRT and LRT station counts change from 2004 to 2017?”

## Source coverage and limitations

| Source                                                                                                                                                                | Coverage used | What it provides                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------- |
| [LTA Train Station Codes and Chinese Names](https://datamall.lta.gov.sg/content/dam/datamall/datasets/Geospatial/Train%20Station%20Codes%20and%20Chinese%20Names.zip) | Jan 2025      | Codes, names, Chinese names, line membership |
| [LTA Train Station Exit Point](https://datamall.lta.gov.sg/content/dam/datamall/datasets/Geospatial/TrainStationExit.zip)                                             | Aug 2025      | 613 official exit coordinates                |
| [LTA Train Lines Codes](https://datamall.lta.gov.sg/content/dam/datamall/datasets/PublicTransportRelated/Train%20Line%20Codes.xlsx)                                   | Feb 2024      | Official line-code and direction records     |
| [data.gov.sg Number of MRT and LRT Stations](https://data.gov.sg/datasets/d_34dc2eb007a14ef406474abfb43c8671/view)                                                    | 2004–2017     | Historical station counts                    |

Use `rail_source_metadata` for official URLs and complete caveats. In particular:

- these are dated snapshots, not live service status;
- the exit mirror describes data from August 2025; July 2026 is its publisher-page update, not data coverage;
- station coordinates are averages of official exit positions, not platform centroids;
- nearest-distance tools calculate straight-line distance, not walking routes;
- the line-direction file predates later extensions;
- the historical series ends in 2017 and omits 2015 and 2016.
