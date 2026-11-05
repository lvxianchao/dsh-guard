# Changelog

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
