# Publishing n8n-nodes-unsora

These steps are for the package owner (Shipped Studio). Do them in order the first time. After that, a release is step 4 alone.

n8n only verifies community nodes that are published **from GitHub Actions with npm provenance**. That is why every release goes through `.github/workflows/publish.yml`, and why you should not run `npm publish` from your machine.

## 0. Before the first release

- [ ] Check `author.email` in `package.json`. It is set to the account owner's address. Change it if the public package should show a different contact.
- [ ] Check that the `n8n-nodes-unsora` name is still free on npm: `npm view n8n-nodes-unsora` should return a 404.
- [ ] Run everything locally once:

  ```bash
  npm ci
  npm run lint
  npm run build
  npm test
  ```

## 1. Create the GitHub repository

1. Create a **public** repository named `n8n-nodes-unsora` under the `Shipped-Studio` organization: <https://github.com/organizations/Shipped-Studio/repositories/new>. Do not add a README, license or .gitignore; the folder already has them.
2. Push this folder as the repository root:

   ```bash
   cd n8n-nodes-unsora
   git init
   git add .
   git commit -m "feat: initial release of unsora n8n nodes"
   git branch -M main
   git remote add origin git@github.com:Shipped-Studio/n8n-nodes-unsora.git
   git push -u origin main
   ```

3. Check that the **CI** workflow (lint, build, test) passes under the repository's **Actions** tab.

The `repository.url` in `package.json` has to match this repository exactly. npm provenance and n8n verification both check it.

## 2. Set up npm trusted publishing (OIDC)

A package name has to exist on npm before you can attach a trusted publisher to it. Pick one of these two ways to make the first release.

**Option A: trusted publisher from the start (recommended).**
1. Sign in to <https://www.npmjs.com> with the account (or the `shipped-studio` org) that should own the package.
2. If npm lets you configure the package before it exists, open **Package settings → Trusted publishing → Add a publisher → GitHub Actions** and enter:
   - Organization or user: `Shipped-Studio`
   - Repository: `n8n-nodes-unsora`
   - Workflow filename: `publish.yml`
   - Environment: leave empty
3. Do not set an `NPM_TOKEN` secret. The workflow uses GitHub's OIDC token.

**Option B: token for the first release, then trusted publishing.**
1. On npmjs.com, go to **Access Tokens → Generate New Token → Granular Access Token** and give it read and write publish access.
2. In GitHub, go to **Settings → Secrets and variables → Actions → New repository secret**, name it `NPM_TOKEN` and paste the token.
3. Do the first release (step 4). The workflow still publishes with provenance.
4. On npmjs.com, add the trusted publisher with the values from Option A.
5. Delete the `NPM_TOKEN` secret in GitHub and revoke the token on npm.

## 3. (Optional) Protect the main branch

Under **Settings → Branches**, require the CI workflow to pass before merging into `main`.

## 4. Release

On an up-to-date `main` branch:

```bash
npm run release
```

`n8n-node release` (which runs `release-it`) will:

1. Run lint and build.
2. Ask for the version bump (patch, minor or major).
3. Update `CHANGELOG.md` and `package.json`, commit, create a tag such as `0.1.0`, push, and create a GitHub release.

Pushing the tag starts **Publish** (`.github/workflows/publish.yml`). It runs `npm ci` and then `npm run release`, which detects GitHub Actions and publishes to npm with provenance (`NPM_CONFIG_PROVENANCE=true`).

Afterwards:

- Check that the workflow passed under **Actions → Publish**.
- Open <https://www.npmjs.com/package/n8n-nodes-unsora> and confirm the **Provenance** badge links to this repository and commit.
- Optionally run n8n's scanner against the published version:

  ```bash
  npx @n8n/scan-community-package n8n-nodes-unsora
  ```

Tags must look like `1.2.3` (no `v` prefix). If you want `v1.2.3`, change the tag filter in `publish.yml`.

## 5. Submit for n8n verification

1. Go to <https://creators.n8n.io/nodes> and sign in, or create an n8n Creator account.
2. Submit `n8n-nodes-unsora`, using the GitHub repository URL and the npm package URL.
3. n8n reviews the package. The automated part is the scanner from step 4: provenance, lint rules, no runtime dependencies, no restricted globals or imports. A person also reviews the UX and the docs.
4. After approval, the node appears when you search the n8n nodes panel for "Unsora", on n8n Cloud as well.

For later releases, repeat step 4. Updates to a verified node are reviewed again before n8n Cloud users get them.

## Release checklist

- [ ] `npm run lint`, `npm run build` and `npm test` pass locally.
- [ ] `CHANGELOG.md` describes the change. `npm run release` updates it, but check the wording.
- [ ] No new entries under `dependencies`. Runtime dependencies are not allowed for verified nodes.
- [ ] The README operations table matches the node.
