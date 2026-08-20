# Security policy

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability. Report it through GitHub's
private vulnerability reporting feature for this repository, with reproduction steps and the
affected package and version.

We aim to acknowledge reports within five business days. Do not include API keys, access tokens,
personal data, or other secrets in reports, logs, fixtures, or screenshots.

## Credentials

The servers read upstream API credentials from environment variables. They never accept arbitrary
upstream URLs, and they do not intentionally log credentials. Users deploying the HTTP transport
are responsible for adding authentication and TLS at the deployment boundary.
