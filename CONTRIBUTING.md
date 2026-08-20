# Contributing

Thank you for helping improve Singapore MCP.

1. Open an issue for substantial changes so the tool contract can be discussed first.
2. Create a focused branch and add tests for behavioural changes.
3. Run `npm run format:check`, `npm run lint`, `npm test`, and `npm run build`.
4. Submit a pull request describing the public data source and its licence or terms.

New integrations must use documented public APIs, keep upstream URLs allowlisted in code, validate
all tool inputs, set request timeouts and response-size limits, and never log credentials.
