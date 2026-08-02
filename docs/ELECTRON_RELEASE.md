# Electron desktop releases & version numbers

The **website never hardcodes** a desktop version. The landing page calls `GET /api/app/latest-release`, which reads GitHub `releases/latest` for `demirrsarppkurtlarr/Descall` and shows e.g. **`v2.4.0 available`**.

## Semver bump rules (by change size)

| Bump | When to use | Example |
|------|-------------|---------|
| **patch** | Bug fixes, small UI tweaks, security patches | `2.3.1` → `2.3.2` |
| **minor** | New features, noticeable improvements, no breaking API | `2.3.1` → `2.4.0` |
| **major** | Breaking changes, large rewrites, incompatible updates | `2.3.1` → `3.0.0` |

## Release from Windows (recommended)

In `frontend/electron` with `GH_TOKEN` set:

```bash
cd frontend/electron
npm run release          # patch bump + build + GitHub release + tag vX.Y.Z
npm run release:minor    # minor bump
npm run release:major    # major bump
```

`release.cjs` will:

1. Bump `frontend/electron/package.json` (and sync the same semver to `frontend/package.json` + root `package.json` via `sync-version.cjs`)
2. Build `Descall-Setup-<version>.exe`
3. Create GitHub release **`v<version>`** on **`Descall`** (correct repo casing)
4. Upload `.exe`, blockmap, and `latest.yml` for auto-update

After publish, the **site updates automatically** on the next page load (and when the tab becomes visible again).

## CI release (tag push)

Pushing a tag `v*` on `main` runs `.github/workflows/release.yml`, which syncs `electron/package.json` from the tag and publishes the Windows installer.

## Agents / maintainers

- Do **not** edit the landing page to show a fixed version like `2.3.1`.
- Always bump semver via `release.cjs` (or a new `v*` tag) when shipping Electron.
- Keep `GITHUB_RELEASE_REPO` (optional env) aligned with `demirrsarppkurtlarr/Descall` if you fork.
- Electron **always** uses production API `https://des-call.onrender.com` (build + runtime). Do not point desktop builds at staging.
