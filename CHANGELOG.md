# Changelog

## 0.4.0

- Make default welcome chat message and title community-neutral and use `{forumName}` dynamically.
- Remove the deployment-specific default rules link. The HTTPS rules URL is now optional.
- Expand supported template variables in the chat title as well as the message body.
- Reject templates that refer to `{rulesUrl}` without a configured URL, rather than sending a broken link.
- Update ACP defaults, documentation and tests to match the public plugin release.
- Add a curated npm file list and maintainer publishing checklist.

Upgrades preserve existing ACP settings and previous delivery state.
