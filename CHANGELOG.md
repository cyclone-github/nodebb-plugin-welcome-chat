# Changelog

## 0.4.1

- Rewrite ACP descriptions to use shorter, more natural wording and remove unnecessary status notices.
- Make "After both approval and email verification" the default delivery mode for new installations, including the server-side fallback. Explicitly saved delivery modes are unchanged.
- Replace the staff groups textarea with an accessible click-to-select/toggle picker populated from existing NodeBB groups. General membership, privilege, and ephemeral groups are not offered.
- Preserve the `groupNames` setting and support both existing line-separated values and new JSON selections (including groups with commas in their names).
- Update the editable default greeting and add a concise placeholder guide and example in the ACP.
- Add group-picker tests and update the documentation. Existing saved settings and chat history are preserved.

## 0.4.0

- Make default welcome chat message and title community-neutral and use `{forumName}` dynamically.
- Remove the deployment-specific default rules link. The HTTPS rules URL is now optional.
- Expand supported template variables in the chat title as well as the message body.
- Reject templates that refer to `{rulesUrl}` without a configured URL, rather than sending a broken link.
- Update ACP defaults, documentation and tests to match the public plugin release.
- Add a curated npm file list and maintainer publishing checklist.

Upgrades preserve existing ACP settings and previous delivery state.
