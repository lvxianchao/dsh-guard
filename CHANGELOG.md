# Changelog

## 3.0.0 — 2026-11-06

### Breaking

- **The settings surface moved into DSH Settings.** v3 ships a `dsh.client` bundle that adds a native **安全 / Security** page to the harness Settings panel (and removes the old floating shield button). The page follows the harness light/dark theme, uses the harness scrolling and keyboard behaviour, and is the entry point from now on. `/__guard/admin` and `/login` still work when opened directly, and the floating shield stays only as a fallback when the client bundle is not active.
- **Requires DSH `0.2.2-rc.1` or newer** (`engines.dsh: >=0.2.2-rc.1 <0.3.0`). On an incompatible host the whole bundle is skipped — the gate then does not listen at all, which is the safe direction for a front door, but upgrade DSH before upgrading this plugin.
- **The sources are TypeScript now.** The published package still ships plain JS and has no runtime dependencies, so `dsh plugin add` needs no toolchain; building is a maintainer concern.

### Added

- Native settings page in the harness: password change, session lifetime, lockout threshold/duration, listener address and port, live session list with per-device revoke, sign out everywhere.
- JSON API behind the native page (`/__guard/api/*`) sharing the same mutators as the form routes.
- Light/dark palettes for the login, sign-out and fallback admin pages: they follow the operating system by default and accept `?theme=light|dark` for an explicit override.
- The fallback shield/overlay now uses the harness theme tokens and no longer sizes itself with `100vh`, so it no longer covers the composer send button or clips its header on mobile.

### Changed

- README and AGENTS.md describe the v3 architecture: `src/` → `lib/` build, the native settings page, and the fallback behaviour.

### Internal

- Build: `tsc` for the server half, `esbuild` for the single-file client bundle; `lib/` is committed so every install path gets the same prebuilt bytes, and CI rejects stale artifacts.
- CI: typecheck + build + artifact freshness on every push and pull request; the release workflow builds before publishing.

## 2.1.1 — 2026-11-05

### Docs

- README and the admin page now describe the persisted session cache and the dead-session redirect; both still claimed sessions lived in memory and that a restart signed everyone out.
- Screenshots re-shot with the corrected wording.


## 2.1.0 — 2026-11-05

### Added

- **Sessions survive a restart.** The table is cached beside the password file (`dsh-web-guard-sessions-<port>.json`, mode 0600, atomic write), so upgrading or restarting DSH no longer signs every browser out — the open tab reconnects instead of hanging on "reconnecting". Rows that expired while the process was down are dropped on load.
- **Dead-session redirect.** The injected client probes the new `/__guard/session` endpoint (200 = live, 401 = gone) when the tab becomes visible, when the browser comes back online, after a WebSocket close, and every 30s. A 401 sends the browser to the login page with `?next=`, so a genuine revocation (password change, sign-out-all) looks like a login prompt rather than a dead spinner.

### Changed

- Restarting the guard is no longer a way to sign everyone out. Use the admin page's "sign out all devices" — revocation is an explicit action now.

### Security

- The session cache stores SHA-256 hashes, never raw tokens. Neither the file nor a heap dump can mint a working cookie.


## 2.0.1 — 2026-11-05

### Internal

- Publishing is automatic: pushing a `v*` tag publishes to npm from GitHub Actions through an OIDC trusted publisher, with provenance. A mismatched tag/version fails the run instead of shipping the wrong thing.


## 2.0.0 — 2026-11-05

### Breaking

- Renamed the package to `@lvxianchao/dsh-web-guard` (was `dsh-guard`) and the on-disk state file to `dsh-web-guard.json`. An old `dsh-guard.json` is **not** migrated: the gate generates a fresh password on first start and logs it once.
- The display name is now **DSH Web Guard** everywhere — login page, sign-out page, admin page, log prefix and health payload.

### Added

- Localised plugin metadata via `locale/en.json` and `locale/zh.json`, so the DSH plugin list shows a translated title and description.
- The settings page opens in an overlay instead of navigating away, and closes only from its own Close button.
- Header actions on the settings page are real buttons; the repository link moved into the title.
- README (both languages): an explicit warning against disabling or uninstalling the gate, and recovery steps for when it has already happened.

## 1.0.0 — 2026-11-04

First stable release.

### Features

- **Password gate** — scrypt-hashed password, revocable sessions with sliding expiry, per-IP lockout after repeated failures.
- **Reverse proxy that removes the 403** — forwards to the harness listener with `Host`/`Origin` rewritten to the loopback authority, which the `/api` browser-trust fence accepts by design.
- **Automatic launch-token exchange** — the harness session cookie is minted in-process and injected upstream; the browser never sees a token and there is nothing to dig out of the journal.
- **Secure-context polyfill** — `crypto.randomUUID` shim for plain-HTTP deployments, where the real API is unavailable outside a secure context.
- **Admin page** at `/__guard/admin` — change the password (current password required), session lifetime, lockout threshold and duration, listener address/port, view and kick live sessions, sign out everywhere. Reachable from the shield button in the harness UI.
- **Localisation** — login, admin and sign-out pages follow the harness language setting (Chinese and English).
- **Optional native TLS** — `tls.certFile` / `tls.keyFile`; otherwise run behind NPM, Caddy or any TLS-terminating proxy.
- **Zero runtime dependencies** — Node standard library only, no build step.

### Configuration precedence

`$DSH_HOME/dsh-guard.json` (written by the admin page) → plugin config in `cordis.patch.yml` → built-in defaults.

### Known limitations

- Single password, single privilege level — not a multi-user system.
- Listener address/port changes require a DSH restart.
- Sessions live in memory; a DSH restart signs everyone out.
- The harness itself must listen on loopback, otherwise the gate can be bypassed by connecting to its port directly.
