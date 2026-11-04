# Changelog

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
