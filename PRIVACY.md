# Privacy Policy

Last updated: August 20, 2026

This policy describes the Olano Singapore MCP packages, command-line interface, Agent Skills, and
plugins in this repository (the “Software”).

## Local operation

The npm packages normally run on your computer over standard input/output. They do not require an
Olano account, include Olano analytics, or send usage telemetry to Olano.

The Software may send requests to the Singapore public-data services selected by the tool you use,
including data.gov.sg, OneMap, LTA DataMall, and SingStat. Those services receive the information
required to answer the request, such as a search term, dataset identifier, location, or stop code,
and are governed by their own privacy policies and terms.

Optional credentials supplied through environment variables or plugin configuration are passed
only to the relevant upstream service. The Software does not intentionally log those credentials.
Your MCP client, package manager, operating system, network provider, and upstream data service may
process information independently of Olano.

## Local storage

Responses are cached in memory for efficiency. If you explicitly set `OLANO_SG_CACHE_DIR`, eligible
public-data responses may also be stored in that local directory. You control that directory and
are responsible for its permissions, retention, and deletion. Do not share a cache directory
between untrusted users.

## Hosted services

This repository does not currently provide an Olano-hosted public MCP endpoint. If Olano introduces
one, its data practices will be documented before it becomes publicly available.

## Changes and questions

Material changes will be published in this file with a new effective date. Privacy questions can
be raised through the repository's public issue tracker:
https://github.com/olano-ai/mcp-singapore/issues
