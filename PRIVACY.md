# Privacy Policy

Last updated: August 31, 2026

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

Olano operates a free Telegram bot, [@OlanoSGBot](https://t.me/OlanoSGBot), so that people can try
these tools without installing anything. The bot is a hosted Olano service rather than part of the
Software, and the local-operation statements above do not apply to it.

**Where it runs.** The bot does not run on your device. It runs as a hosted agent on an Olano server
located in Singapore, which calls the same upstream Singapore public-data services described above.

**What Telegram sees.** Messages reach the bot through Telegram and are subject to
[Telegram's privacy policy](https://telegram.org/privacy). Telegram passes the bot the content of
the messages you send it and your account identifier on that platform.

**Separation between users.** Each user's conversation and stored memory is kept separately, keyed
to the messaging platform and to the account identifier on that platform. One user's data is not
accessible to another user, and the agent answering you is scoped to your identifier alone: it
cannot read another user's messages or memory.

**Language-model processing.** To interpret a question and compose a reply, the bot sends the
relevant message content to a third-party large-language-model provider. That provider may process
the content outside Singapore, under its own terms and privacy policy.

**What to send.** Send only what you are comfortable having processed this way, and do not send
confidential or sensitive personal information to the bot. Run the npm packages locally if you need
the request to stay on your own machine.

This repository does not currently provide an Olano-hosted public MCP endpoint. If Olano introduces
one, its data practices will be documented before it becomes publicly available.

## Changes and questions

Material changes will be published in this file with a new effective date. Privacy questions can
be raised through the repository's public issue tracker:
https://github.com/olano-ai/mcp-singapore/issues
