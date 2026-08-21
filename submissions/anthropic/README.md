# Anthropic community directory submission

`claude-community-form.md` holds the prepared, field-by-field answers for every plugin.
`community-plugins.json` is the same metadata in machine-readable form.

Submissions go through the web form at **https://clau.de/plugin-directory-submission**. Pull
requests opened directly against `anthropics/claude-plugins-community` are closed automatically:
that repository is a read-only nightly mirror of Anthropic's internal review pipeline. The form
requires a signed-in Claude account, so this step cannot be automated from CI.

Submit the aggregate `olano-singapore` plugin for users who want the complete suite, plus the six
focused plugins, which give reviewers and users narrower installation choices with clearer
permissions and a tighter activation scope.

The repository is public, every plugin has a `.claude-plugin/plugin.json`, the root marketplace
validates, and updates stay tied to the public GitHub source. As of 0.3.0 the root marketplace and
all seven plugins pass `claude plugin validate`, and `npm run check:plugins` reports 7 Claude Code
plugins and 15 packaged skill copies.

Approved plugins install with the `@claude-community` suffix, for example:

```text
/plugin install olano-singapore@claude-community
```

Record the outcome in `../directories/mcp-directories.json` once a listing becomes publicly
visible.
