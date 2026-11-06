# dsh-web-guard v3.0.0 — architecture and work split

Internal design note, not shipped (the `files` list has no `docs/` entry besides
`docs/logo.svg`). Read this before touching `src/`.

## What v3 changes

1. Full TypeScript. `src/**` compiles to `lib/**` with `tsc`; the browser bundle
   is produced by `esbuild` from `src/client/**`. `lib/` is committed so
   `dsh plugin add github:…`, a checkout install and the npm tarball all ship
   prebuilt JS — users still install with no toolchain.
2. Native settings page. A `dsh.client` bundle registers a `settings.section`
   page (id `web-guard`, DSH Settings → 安全) and its `settings.section.icon`.
   It renders in the harness React tree with `--dsw-alias-*` tokens, so theme,
   scrolling, keyboard handling and mobile layout come from the host.
3. The old floating shield + iframe stays only as a **fallback**: the client
   module removes it on activation. `/__guard/admin` and `/login` remain
   reachable directly (bookmark, older host, client bundle failed to load).
4. Standalone pages (login, signed out, fallback admin) get light/dark palettes
   from `src/shared/theme.ts`, following `prefers-color-scheme`, with
   `?theme=light|dark` as an override.
5. `engines.dsh` is declared so an incompatible host skips the whole bundle
   (fail-closed: port 3081 never listens) instead of booting a half-working UI.

## Layout and ownership

```
src/index.ts        plugin body: config/state, router, gate listener   (server)
src/proxy.ts        upstream forwarding, Host/Origin rewrite           (server)
src/auth.ts         scrypt hash + session table                        (server)
src/i18n.ts         en/zh strings for server-rendered pages            (server)
src/page.ts         login + signed-out documents                       (server)
src/admin.ts        fallback admin document (themed)                   (server)
src/inject.ts       fallback FAB + overlay injection                   (server)
src/polyfill.ts     crypto.randomUUID shim                             (server)
src/shared/api.ts   JSON API types                      (contract, read-only)
src/shared/theme.ts standalone page palettes            (contract, read-only)
src/types/*.d.ts    local structural host/server types   (contract, read-only)
src/client/         React settings page + loader entry   (client)
scripts/build.mjs   build (tsc + esbuild)                (lead-owned)
tsconfig*.json, package.json, cordis.patch.yml           (lead-owned)
test/e2e.mjs        live HTTP checks                     (server owner)
```

Write scopes: server owner only touches `src/*.ts` (top level), `test/`;
client owner only touches `src/client/`. Both may read `src/shared`, `src/types`.
`package.json`, `tsconfig*.json`, `scripts/`, `README*`, `AGENTS.md`,
`CHANGELOG.md`, `docs/`, CI workflows are lead-owned.

## Build

```bash
npm run build      # tsc -p tsconfig.json  → lib/*.js + esbuild → lib/client.js
npm run typecheck  # server + client, no emit
```

Client bundle shape: a classic script that calls

```js
window.__ModuleLoader__.load({ id: '@lvxianchao/dsh-web-guard', factory: (require) => { … return module.exports } })
```

`require('react')` and `require('react/jsx-runtime')` resolve against the host
module table; nothing else may be imported at runtime. Do not import any
`@deepseek-ai/*` runtime value (type-only imports are erased and allowed, but
this plugin keeps its own structural types in `src/client/types.d.ts`).

## Host facts the implementation relies on (DSH 0.2.2-rc.1)

- `settings.section` is a `list`/`root` slot. Registration options:
  `{ name: 'settings.section', id, order, label }` where `label` may be a
  function returning the current locale's string; the component receives
  `{ close }`. `settings.section.icon` is the matching nav icon, same `id`,
  props `{ size, active }`.
- `ctx.slots.inject(key, callback)` installs the callback for the declaration
  lifetime and returns a disposer tied to the plugin fiber — no manual re-arm.
- `ctx.locale.register(ns, { zh, en })` + `ctx.locale.bind(ns)`; pass
  `locale: ns` in the registration and/or `inject: () => ({ t })` so the
  component gets `t`.
- Theme: use `var(--dsw-alias-*, <fallback>)`. Dark mode is the presence of
  `body[data-ds-dark-theme]`; never hardcode a dark palette in the native page.
- A throwing slot component blanks that slot entry, so the page must be
  defensive: every fetch error renders an inline message, never throws.

## JSON API (server must implement, client must consume)

Base: `/__guard/api`. Session cookie required for all routes (401 JSON
`{ ok:false, error:'unauthorized' }` otherwise). Mutating routes require
`content-type: application/json` and a same-host `Origin` (403 `forbidden`).
Every response is JSON with `ok`; errors use the `GuardErrorCode` union in
`src/shared/api.ts`. Never redirect from an API route.

| Route | Method | Request | Success |
| --- | --- | --- | --- |
| `state` | GET | — | `GuardStateResponse` |
| `settings` | POST | `UpdateSettingsRequest` | `UpdateSettingsResponse` (clamps like the form route: sessionDays 0–365, maxAttempts 1–50, lockMinutes 1–1440, listenPort 1–65535, listenHost ≤64 chars; invalid values → `invalid_field` + `field`) |
| `password` | POST | `ChangePasswordRequest` | `GuardOkResponse`; errors `wrong_current`, `too_short` (<6), `mismatch` |
| `kick` | POST | `KickRequest` | `GuardOkResponse` (`kick_missing` when the id is unknown) |
| `logout-all` | POST | — | `GuardOkResponse` + cleared session cookie |

Server-rendered form routes keep working unchanged (`POST /__guard/admin`,
`/__guard/kill`, `/__guard/logout-all`) for the fallback page; the JSON routes
share the same mutators so behaviour cannot drift.

## Client behaviour

- Register `settings.section` (id `web-guard`, order 500, label from locale
  dict) + `settings.section.icon`; optional `conversation.session.header.utilities`
  quick entry is out of scope for v3.0.0.
- Page sections: session/security settings (sessionDays, maxAttempts,
  lockMinutes), password change (current/new/confirm), listener host/port with
  "restart to apply" note, active sessions table with kick buttons, and
  "sign out all devices" (confirm).
- All labels through the locale namespace `webGuard`; both `zh` and `en`.
- On success show a transient inline notice (no alert()); keep the page markup
  and spacing close to the harness settings rows.
- `apply()` must be side-effect free at factory registration; styles and the
  FAB removal go inside `ctx.effect` with disposers.
- Fallback removal: on activation delete `#dsh-web-guard-fab` and its overlay,
  and their style tag. If this bundle is absent (older host, load failure) the
  injected FAB remains the entry.

## Verification (lead runs)

```bash
npm run typecheck && npm run build
npm test                       # against a running gate, see AGENTS.md
# shadow instance: dsh --profile web --patch ./dev.local.yml --host 127.0.0.1 --port 3099 --no-open
# headless Chrome (mobile 390×844 + desktop): settings entry present, no FAB,
# page follows light/dark, login page follows prefers-color-scheme, /__guard/admin still themed
```
