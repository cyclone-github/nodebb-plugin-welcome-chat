# Release and publishing guide

Repository: https://github.com/cyclone-github/nodebb-plugin-welcome-chat (create this repository first)
npm package: https://www.npmjs.com/package/nodebb-plugin-welcome-chat

The source repository is hosted on GitHub. NodeBB ACP installs through npm and the NodeBB package index (nbbpm). The repository does not yet exist at the time this file was prepared.

## Before publishing

- Validate the actual installed NodeBB version against `package.json`'s `nbbpm.compatibility` (`^4.14.0` currently).
- Perform a live test on NodeBB 4.14+ with disposable new accounts. Unit tests are not a substitute for testing ACP settings, chat creation, notifications, and enrollment with the forum's configured registration flow.
- Check for credentials, real users' data, and forum-specific URLs before publishing.
- Verify that the npm name `nodebb-plugin-welcome-chat` is available or that you own it.
- Enable 2FA for npm, and use an authenticated npm CLI session for the initial publish.

## Initialize the source repository

Create an EMPTY public repository named `nodebb-plugin-welcome-chat` under `cyclone-github` on GitHub. Do not pre-populate README, .gitignore or LICENSE.

```sh
git init -b main
git add .
git commit -m 'Initial public release v0.4.0'
git remote add origin git@github.com:cyclone-github/nodebb-plugin-welcome-chat.git
git push -u origin main
```

Use the HTTPS remote instead if that is how your local Git credentials are configured.

## Validate and publish to npm

In the source repository directory:

```sh
node --version
npm --version
npm test
npm run check
npm pack --dry-run
npm login
npm whoami
npm publish --access public
npm view nodebb-plugin-welcome-chat version
```

Do not publish before the repository exists. The `repository` URL in `package.json` points to it. Note that publishing an npm package version is irreversible: a published `name@version` cannot be republished with different files.

## Tag the release

After the npm publish succeeds:

```sh
git tag -a v0.4.0 -m 'Welcome Chat v0.4.0'
git push origin v0.4.0
```

Optionally create a GitHub Release with that tag.

## Future versions

After changing code, edit CHANGELOG, run tests, bump npm version, commit the changes, push, and publish the next version.

```sh
npm version patch
npm test
npm run check
npm publish --access public
git push origin main --follow-tags
```

`npm version patch` creates the new version commit and Git tag automatically when run in a clean Git repository. Confirm version and tests before publishing; for nontrivial changes prefer manual review and explicit tags.

For GitHub Actions-based automatic publishing, use npm's Trusted Publishing (OIDC) and a separately configured release workflow. The included `.github/workflows/test.yml` runs tests only and will NEVER publish to npm.

## After publishing

- Check the npm package web page and `npm view nodebb-plugin-welcome-chat version`.
- Allow nbbpm index and ACP cache time to refresh.
- Search ACP > Extend > Plugins on a compatible NodeBB installation.
- A NodeBB instance below v4.14 will not be included in the declared compatibility range.
- Some NodeBB hosts disable plugin installation in the ACP, so an npm installation may be required in that case.
- For YunoHost, use `sudo yunohost app shell nodebb` for CLI interactions and restart NodeBB through the YunoHost-managed service.

## Existing installations

Settings saved previously in ACP may retain previous forum-specific welcome text and rules URLs. The generic v0.4.0 defaults do not migrate or overwrite saved settings.
