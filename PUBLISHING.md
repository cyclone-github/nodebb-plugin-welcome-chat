# Browser-only GitHub and npm publishing guide

This release contains a manual GitHub Actions publishing workflow. You do **not** need to run git, npm, or SSH commands on your machine.

## GitHub source update (0.4.1)

For an existing repository, upload the **changed files** via the GitHub web UI, preserving their paths. The easiest safe route is to create a new branch and open a pull request, then merge it after the Test workflow passes. Do not upload the zip itself or create a nested source directory.

## Initial GitHub publication (only for a new repo)

1. Sign in to GitHub as `cyclone-github` and create a **public**, empty repository named `nodebb-plugin-welcome-chat`. Do not initialize a README, license, or gitignore.
2. Download and extract the complete source ZIP locally using your graphical archive manager.
3. In the empty repository, select **uploading an existing file**. Alternatively, use **Add file > Upload files**.
4. Drag the **contents of the extracted `nodebb-plugin-welcome-chat` folder**, not the outer folder or the ZIP, into GitHub. Preserve the folder structure. On Linux, show hidden files with Ctrl+H before selecting, since `.github` and `.gitignore` must be uploaded too.
5. Verify that `package.json`, `library.js`, and `plugin.json` will be in the repository root and `.github/workflows/test.yml` and `.github/workflows/publish.yml` will be in their proper nested folders.
6. Commit the upload directly to `main`. The test workflow will run on the first commit.

## Initial npm publication using only web interfaces

1. Create or sign into your account at `https://www.npmjs.com/`. Set up account 2FA.
2. Check ownership of `nodebb-plugin-welcome-chat` at `https://www.npmjs.com/package/nodebb-plugin-welcome-chat`. Availability is not guaranteed until publishing succeeds.
3. From your npm profile menu, open **Access Tokens > Generate New Token** and create a **Granular** access token named `welcome-chat-first-release`:
   - Packages and scopes: **Read and write (publish and stage)**, **All Packages** (required while the unscoped package does not yet exist).
   - **Bypass two-factor authentication** enabled, required for noninteractive direct publishing from Actions.
   - Organizations: No access.
   - A short expiration period (for example, 7 days).
   - Do not specify IP allowlists unless you know GitHub-hosted runner IPs will be authorized.
   - Copy the full token immediately; npm only shows it once.
4. On your GitHub repository: **Settings > Secrets and variables > Actions > New repository secret**. Set the name to `NPM_TOKEN` and value to the generated npm token.
5. Wait for the GitHub repository's **Actions > Test** workflow to pass. Test on a real compatible NodeBB installation before publicly releasing.
6. In **Actions > Publish to npm**, click **Run workflow**, select `main`, and run. This manually triggered workflow tests source and invokes `npm publish --access public` using the stored secret.
7. Confirm the green workflow result, then visit `https://www.npmjs.com/package/nodebb-plugin-welcome-chat` and confirm v0.4.1 exists.
8. On GitHub, open **Releases > Draft a new release**, create tag `v0.4.1` from `main`, and publish the release.
9. Revoke the temporary npm token in npm **Access Tokens** and delete the GitHub `NPM_TOKEN` repository secret.

## Subsequent npm releases: trusted publishing

Once the package exists on npm, navigate to its **Settings > Trusted publishing**. Connect the GitHub Actions workflow under owner `cyclone-github`, repository `nodebb-plugin-welcome-chat`, filename `publish.yml`. Allow direct `npm publish`, and leave environment name empty unless you configure an equivalent GitHub environment.

To switch away from the temporary token in GitHub's web editor, edit `.github/workflows/publish.yml`:

- Change the permissions block to include `id-token: write` as well as `contents: read`.
- Remove the entire `env:` / `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` section of the Publish step. Keep `npm publish --access public`.
- Commit this modification through the GitHub UI.
- For each new version, edit `package.json` (and release notes) on GitHub to a new semver version, test, and click **Actions > Publish to npm > Run workflow**.
- A release version cannot be overwritten: v0.4.1 cannot be published again with new bytes.

npm requires compatible Node/npm versions for trusted publishing (Node 22.14+/npm 11.5.1+). GitHub-hosted Node 24 typically meets this requirement.

npm has announced deprecation of direct publishing with bypass-2FA granular tokens in January 2027. Prefer OIDC trusted publishing after your initial publication.

## NodeBB discovery

`package.json` supplies the `nodebb-plugin-` package prefix and `nbbpm.compatibility: ^4.14.0`. Once npm and NodeBB's package index update, the plugin can appear in ACP's compatible plugin list. In the meantime, confirm your installed NodeBB is at least 4.14 and its Node.js is 22+; some managed installations disable ACP package installs.

Note: when npm already has v0.4.0, publish v0.4.1. Never attempt to overwrite an existing npm version.
