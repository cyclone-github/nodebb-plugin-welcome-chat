# NodeBB Welcome Chat

A configurable NodeBB plugin that automatically starts **a private welcome group chat** for a new member. The chat includes the member and the current members of selected staff groups, and sends an editable greeting from a staff account.

The default message and title use NodeBB's **configured forum name**.

**Requirements:** NodeBB 4.14.x or later in the 4.x series, Node.js 22 or later. The declared NodeBB compatibility range is `^4.14.0`. This plugin uses NodeBB 4.14+ ESM integration and internal messaging APIs. Test against your installed NodeBB release before deploying to a production forum.

## Features

- Automatic private welcome group chat for **new registrations**
- Delivery modes: on account creation, after NodeBB's built-in administrator approval (when enabled), after email verification, or after both (**default**)
- Click-to-select staff groups loaded from your NodeBB installation, including `administrators`, `Global Moderators`, and any custom groups, plus optional staff user IDs
- Optional preferred sending staff user ID
- Editable chat title and message body, with `{username}`, `{forumName}`, and `{rulesUrl}` variables
- Optional rules URL can be included in the message

## Install

Once published to npm, use **ACP -> Extend -> Plugins** to locate and install `nodebb-plugin-welcome-chat` on compatible NodeBB versions. Activate the plugin and rebuild/restart NodeBB if prompted.

Alternatively, install from your NodeBB directory:

```sh
npm install nodebb-plugin-welcome-chat
./nodebb build
./nodebb restart
```

To test an unpublished checkout locally:

```sh
npm install /path/to/nodebb-plugin-welcome-chat
./nodebb build
./nodebb restart
```

Open **ACP -> Plugins -> Welcome Chat**, at `/admin/plugins/welcome-chat`, to configure it. Choose the delivery mode, click the staff groups to include (click again to remove), edit the message if desired, then enable and save. Only newly created accounts can receive a welcome.

## Default welcome chat

**Chat title:** `Welcome to {forumName}`

**Message:**

```text
Hi {username},

Welcome to {forumName}! We're glad you're here.

If you have any questions, feel free to reply to this chat.
Our team will be happy to help.

Thanks for joining!
```

NodeBB's configured forum name replaces `{forumName}`. Administrators can edit the title and entire message in the ACP. Changes apply to future welcome chats; they do not rewrite messages already sent.

**Template variables** (available in both title and message):

| Variable | Meaning |
| --- | --- |
| `{username}` | New member's username |
| `{forumName}` | Forum name from NodeBB settings |
| `{rulesUrl}` | Administrator-supplied HTTPS rules URL (optional) |

The ACP explains how to use all three placeholders, including an example of linking to the rules page. There is deliberately no default rules URL. To include a rules link, configure **Forum rules URL** in the ACP and add a line such as `Rules: {rulesUrl}` to the message. If `{rulesUrl}` appears in a template but no URL is configured, delivery fails with a logged error rather than sending an empty or incorrect URL. The configured URL must begin with `https://`.

## Settings

| Setting | Behavior |
| --- | --- |
| Enable automatic welcome chats | Off until deliberately enabled/saved |
| Send welcome DM | Default: after both approval and email verification |
| Staff groups | Default: `administrators` and `Global Moderators`; select other existing groups by clicking them |
| Additional staff user IDs | Optional comma/space-separated UIDs |
| Sender user ID | Optional UID of a selected staff member |
| Chat title | Default: `Welcome to {forumName}` |
| Forum rules URL | Optional HTTPS URL; initially empty |
| Message body | Editable default text shown above |

The staff group picker excludes built-in general membership groups such as `registered-users`, as well as ephemeral and privilege groups. Selecting one or more custom groups adds their members to the chat. The original `groupNames` storage key is preserved: pre-0.4.1 comma- or newline-separated lists continue to work, while new selections save as a JSON list to support group names containing commas. Groups that no longer exist are shown as `(not found)` so you can deselect them.

The sending account must be a selected participant. If the preferred sender is missing, the plugin chooses the lowest-numbered administrator in the selected group, or otherwise the lowest-numbered staff member.

### Delivery modes and approval

- **Account created**: send when NodeBB calls `action:user.create`.
- **After administrator approval**: for NodeBB's native approval queue, the account is not created until approved. If the forum does **not** require approval, account creation also satisfies this setting.
- **After email verification**: wait until NodeBB marks the address as verified (`email:confirmed=1`).
- **After both**: require the newly created account and email verification. For registrations queued in NodeBB core, creation occurs following approval.

The plugin tracks new accounts at creation time. Email-confirmed events from accounts registered before the plugin was enabled do not trigger new chats. Email-gated modes remain pending when users never confirm their email, including if email verification is not required in NodeBB. Third-party approval workflows may behave differently.

## Operational limitations

1. Staff membership is captured when the room is created. Staff group changes do not update existing rooms; category-specific moderators are not necessarily `Global Moderators`.
2. The chat feature must be enabled in NodeBB. NodeBB chat limits, member permissions, message-length limits and notification preferences still apply. Members may be unable to reply until they have chat privileges.
3. The plugin refuses rooms with more than 100 staff participants or rooms exceeding NodeBB's configured participant limit. A selected group with more than 100 members fails closed.
4. Multiple workers use a best-effort expiring database lock. Exactly-once delivery is **not** guaranteed across crashes or an expired lease. A saved-message checkpoint reduces duplicate notifications on retries.
5. Failed deliveries are logged and do **not** block registration. There is no automatic retry queue or backfill of existing accounts. A user whose delivery failed may need an explicit retry mechanism outside the plugin.
6. Upgrading an existing installation retains **saved ACP settings**, including any previously customized room title, message, rules URL, groups, and delivery mode. Changing the packaged defaults does **not** overwrite settings already stored in NodeBB. Review existing settings after upgrading. In particular, an explicitly saved "When account is created" setting will continue to send at creation even though the fresh default is now "After both".

## Test

```sh
npm test
npm run check
npm pack --dry-run
```

Unit tests use doubles for NodeBB's modules. They do not verify NodeBB loading, ACP save/load, actual chat delivery or notifications. Before publishing, verify the plugin on a disposable NodeBB 4.14+ installation, then register a new test account for each delivery mode your forum uses.

## License

MIT. See [LICENSE](LICENSE).

## References

- [NodeBB plugin documentation](https://docs.nodebb.org/development/plugins/)
- [NodeBB plugin settings documentation](https://docs.nodebb.org/development/plugins/settings/)
- [NodeBB plugin discovery (nbbpm)](https://docs.nodebb.org/development/plugins/)
