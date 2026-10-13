# NodeBB plugin development audit

Reviewed on 2026-10-12 against the current NodeBB documentation and the NodeBB v4.16.2 source code. v4.16.2 is the release tagged on 2026-10-05.

| Page | Relevance | Assessment / action |
|---|---|---|
| [Writing Plugins](https://docs.nodebb.org/development/plugins/) | Required | Proper `nodebb-plugin-` package name and hook-based entrypoint in `plugin.json`; uses `nbbpm.compatibility`. |
| [Available Hooks](https://docs.nodebb.org/development/plugins/hooks/) | Required | Listens to `action:user.create` and `action:user.email.confirmed`. No attempt to return payloads from action hooks. ACP sidebar uses `filter:admin.header.build` and returns modified header. |
| [Adding Routes](https://docs.nodebb.org/development/plugins/routes/) | Required | ACP page registered on `static:app.load` with `setupAdminPageRoute`. Uses built-in administrator middleware; no unnecessary public or REST endpoints. |
| [Using Core Libraries](https://docs.nodebb.org/development/plugins/core-libraries/) | Required | `nodebb.require()` for v4.14+, NodeBB database abstraction, groups/user/messaging APIs; no raw Redis/Mongo-specific commands. |
| [Plugin Settings](https://docs.nodebb.org/development/plugins/settings/) | Required | ESM ACP module uses `load`/`save` imported from `settings`; form `name=` fields persist via shared namespace. Template's imported core settings header supplies `#save`. `enabled` is checked against string `'on'`, not truthiness. |
| [Using Third-Party Libraries](https://docs.nodebb.org/development/plugins/libraries/) | Applicable | No third-party runtime JS dependencies; `modules` names the client admin module. |
| [plugin.json](https://docs.nodebb.org/development/plugins/plugin.json/) | Required | Unique plugin `id`, library entrypoint, manifest hooks, template path, ESM admin module path. No extraneous static dirs. |
| [Static Directories](https://docs.nodebb.org/development/plugins/statics/) | Not needed | Does not mount staticDirs and does not expose messages, account data, or settings files publicly. |
| [Post Parsing](https://docs.nodebb.org/development/plugins/parsing/) | Not needed | No post parser hook, and welcome chats use NodeBB's native chat message pipeline. |
| [Uncategorized (cid -1)](https://docs.nodebb.org/development/plugins/uncategorized/) | Not needed | Creates no topics/posts, only private chat rooms. |
| [Quickstart Plugin](https://docs.nodebb.org/development/quickstart/) | Useful example | Mirrors upstream plugin hook/export pattern and `nodebb.require()`. |
| [Style Guide](https://docs.nodebb.org/development/style-guide/) | Advisory | ES modules and whitespace consistently styled; an upstream ESLint check is not run. |

## Backend / API cross-check

- `src/user/approval.js`: queued registrants do not have UIDs until approved; the account create hook therefore runs after native queue approval.
- `src/user/create.js`: create hook can be fired after email handling; email-confirmed hooks may arrive first for already-verified accounts.
- `src/user/email.js`: confirmation fires `action:user.email.confirmed` after persisting `email:confirmed = 1`.
- `src/messaging/rooms.js`: `newRoom(senderUid, { uids, type, roomName, ... })` creates a private chat with explicit member UIDs.
- `src/messaging/create.js` and `data.js`: `sendMessage()` returns a saved message including its ID; `getMessagesData` retrieves it for notification retry.
- `src/messaging/notifications.js`: `notifyUsersInRoom` is the notification step; NodeBB catches/logs some failures internally.
- `src/database/redis/main.js` and `src/database/mongo/main.js`: both backends provide atomic `increment` and key expiry; the plugin uses a dedicated expiring lock key.
- `src/views/admin/partials/settings/header.tpl`: imported settings header supplies `<button id="save">`, which the ACP module binds.

## Outstanding limitations / deployment gates

1. NodeBB 4.x minor API variations remain possible. Live test with the exact installed NodeBB release.
2. No transactional exactly-once guarantees: lock lease expiry, crashes between message persistence and checkpoint, and NodeBB swallowing notification errors leave rare edge cases.
3. The plugin does not automatically backfill or retry accounts that failed delivery and does not dynamically update previously created rooms as group membership changes.
4. NodeBB's participant-count and chat permissions still apply, and account reputation rules may prevent immediate replies.
5. Review the selected group names and number of members before activation. For category-specific moderators, assign them to a selected group explicitly.
6. Review logs and confirm that ACP values persist after saving and reopening. Use a disposable account to test all relevant delivery modes.
