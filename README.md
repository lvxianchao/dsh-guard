<p align="center">
  <img src="https://raw.githubusercontent.com/lvxianchao/dsh-web-guard/main/docs/logo.svg" width="96" height="96" alt="DSH Web Guard">
</p>

<h1 align="center">DSH Web Guard</h1>

<p align="center">
  A password gate for the <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> Web UI —
  one plugin that fixes four deployment problems at once.
</p>

<p align="center"><a href="README.zh.md">中文说明</a></p>

| Problem | Vanilla behaviour | dsh-web-guard |
|---|---|---|
| No human login | A per-process `?token=` printed to the terminal, new on every restart | One password + revocable sessions |
| `/api` returns 403 behind a proxy | The browser-trust fence requires `Host` to arrive unrewritten; NPM/Caddy rewrite it | The proxy rewrites `Host`/`Origin` to the loopback authority, which the fence accepts |
| Token lives in the journal | `journalctl \| grep token` before you can get in | Exchanged in-process; the browser never sees a token |
| UI breaks on plain HTTP | `crypto.randomUUID is not a function` outside a secure context | Injects a `getRandomValues` polyfill |

Zero runtime dependencies (Node standard library only), no build step — `dsh plugin add` and it runs.

## Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/lvxianchao/dsh-web-guard/main/docs/login-en.png" width="47%" alt="Login page">
  &nbsp;
  <img src="https://raw.githubusercontent.com/lvxianchao/dsh-web-guard/main/docs/logout-en.png" width="47%" alt="Signed-out page">
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/lvxianchao/dsh-web-guard/main/docs/admin-en.png" width="92%" alt="Admin page">
</p>

<p align="center"><sub>Login page &nbsp;·&nbsp; sign-out confirmation &nbsp;·&nbsp; admin page (password, session and lockout policy, listener, live sessions)</sub></p>

## How it works

```
browser ──HTTP(S)──> dsh-web-guard :3081 ──> DSH listener (loopback)
                          │
                          ├─ not signed in → /login
                          ├─ signed in → forward, Host/Origin rewritten to loopback
                          └─ injects the harness cookie (never exposed to the browser)
```

The harness fence accepts a loopback authority, so making every upstream request look like one removes the 403 entirely. Authentication happens **in the proxy**, not as a front-end overlay — a request without a session cookie never reaches the harness.

## Install

```bash
# npm (once published)
dsh plugin --profile web add @lvxianchao/dsh-web-guard

# from GitHub
dsh plugin --profile web add "github:lvxianchao/dsh-web-guard"

# from a local checkout
dsh plugin --profile web add /path/to/dsh-web-guard
```

`main` only ever carries released code (development happens on `dev`), so this
installs the latest stable release. Installing is enough — the package declares `dsh.bundle`, so the guard row is
mounted automatically. Restart `dsh`.

**On first start a password is generated**, printed to the terminal and stored
(hashed) in `<profile>/data/dsh-web-guard.json` with mode `0600`. To pin your own,
add a row to `~/.dsh/profiles/web/cordis.patch.yml` (it overrides the bundle
defaults):

```yaml
- id: guard
  config:
    listenHost: '0.0.0.0'
    listenPort: 3081
```

Note that a profile patch replaces the whole `config` object, so restate every
key you care about.

> The harness itself must listen on loopback (its default). If it is bound to a LAN address, clients can bypass the gate by connecting there directly — the plugin detects this at startup and warns.

## ⚠️ This is the front door, not an optional plugin

Once installed, **dsh-web-guard is the only way in**: it listens on 3081 and forwards to a DSH that is bound to loopback only (3080). If the plugin stops loading, 3081 stops listening and **both your LAN and the internet lose access at once** — while DSH itself keeps running, with your sessions and data intact. That is the dangerous shape: the door is welded shut and you are standing outside it.

**If you exposed this address to the internet, take this seriously.**

Three rules:

1. **Do not uninstall it and do not disable it.** Concretely: don't run `dsh plugin --profile web remove @lvxianchao/dsh-web-guard`, don't drop the entry from `dsh.profile.bundles` in the profile's `package.json`, and don't add `disabled: true` to it in `cordis.patch.yml`.
2. **DSH's Settings → Plugins page is a read-only inventory** — status tags only (enabled / disabled / failed), no toggles. Don't go looking for an off switch there; accidents happen on the command line instead.
3. Upgrading, editing config and `systemctl restart dsh-web` are all safe. Only "making it not load" is not.

### If you closed it by accident

Relax: **DSH is still running on `127.0.0.1:3080`; sessions, workspace and password are all intact.** Only the gate is gone. Recovery takes two commands and **does not depend on the plugin being loaded**:

```bash
# 1) install it again (use file: if you installed from a checkout)
dsh plugin --profile web add file:/path/to/dsh-web-guard
# or: dsh plugin --profile web add github:lvxianchao/dsh-web-guard

# 2) restart, and 3081 starts listening again
sudo systemctl restart dsh-web
```

If you removed it by adding `disabled: true`, delete that line and restart. **Your password is not lost** — the hash lives in `<profile>/data/dsh-web-guard.json`; leave that file alone.

**The real trap is not these two commands — it is that you can no longer reach the machine.**

The gate only proxies DSH's HTTP entry point; it does not touch SSH. But if all your remote access funnels through this one hostname, losing the plugin leaves you exactly one option: **a path that does not go through it.** Have one ready, and **verify it now**, not after the incident:

- a hypervisor console (PVE / ESXi / cloud VNC) into the container or VM, then run the two commands;
- or an independent SSH path (direct LAN, bastion, or VPN).


One last thing: **do not keep these recovery commands only on the machine that hosts the gate.** Copy them somewhere you can open from outside.

## Deployment topologies

**1. Direct, no reverse proxy** — let the plugin terminate TLS:

```yaml
config:
  listenHost: '0.0.0.0'
  listenPort: 8443
  tls:
    certFile: /path/fullchain.pem
    keyFile: /path/privkey.pem
```

The session cookie is issued with `Secure`. Point DNS at the host and open one port.

**2. Behind a reverse proxy (NPM / Caddy / Traefik)** — the proxy does TLS, the plugin does auth:

Set the upstream to `http://<dsh-host>:3081` and enable WebSocket support. **No Host-rewrite configuration is needed** — that is the part this plugin removes.

**3. Plain LAN** — HTTP plus password. Simplest, least safe: the session cookie can be sniffed on a shared network.

## Language

The login and admin pages follow the harness language setting: the plugin reads
`preference` from the `locale` row in the profile patch file (`~/.dsh/profiles/web/cordis.patch.yml`),
which is exactly where the harness settings UI writes it. Chinese and English are
supported. With no explicit preference the pages fall back to the browser's
`Accept-Language`.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `listenHost` | `0.0.0.0` | Interface the gate listens on |
| `listenPort` | `3081` | Gate port; must differ from the harness port |
| `password` | — | Plaintext password, hashed at startup |
| `passwordHash` | — | `scrypt$N$r$p$salt$key`; takes precedence over `password` |
| `sessionDays` | `7` | Session lifetime; `0` = expires when the browser closes |
| `maxAttempts` | `5` | Consecutive failures before a temporary lock |
| `lockMinutes` | `5` | Lock duration |
| `polyfill` | `true` | Inject the `crypto.randomUUID` shim |
| `title` | `DeepSeek Harness` | Heading on the login page |
| `tls` | `null` | `{certFile, keyFile}` to serve HTTPS |

Generate a hash for the config:

```bash
node -e "import('./lib/auth.js').then(m=>console.log(m.hashPassword(process.argv[1])))" 'your-password'
```

## Security model

- Passwords are hashed with scrypt (random salt). The plaintext appears exactly once, in the generated-password log line.
- Session tokens are stored server-side as SHA-256 digests; cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` when TLS is on.
- Login POSTs are checked for a same-hostname `Origin`. The session cookie's `SameSite` attribute is the primary CSRF defence.
- Repeated failures from one IP trigger a temporary lock (in-memory, cleared on restart).
- **The session table is cached on disk** (`<profile>/data/dsh-web-guard-sessions-<port>.json`, mode `0600`, atomic tmp+rename), so **restarting DSH no longer signs signed-in browsers out**. The file holds SHA-256 digests, never tokens — neither the cache nor a heap dump can mint a working cookie. The filename carries the listener port, so a shadow instance cannot overwrite the live one.
- `/logout` ends the current browser session. To revoke everything (a suspected leak, say), use the admin page's **sign out all devices** — **a restart is not a revocation any more**.

**This is not multi-user.** One password, one privilege level. The harness agent can execute code, so anyone who gets in has code execution on that host — which is the product's design, not a bug in the gate.

## When the session is gone

If the session disappears (password changed, sign-out-all, or no activity within `sessionDays`), an open tab does not sit on "reconnecting" forever:

- it probes `/__guard/session` when the tab becomes visible, when the network comes back, after a WebSocket close, and every 30 seconds
- only an explicit **401** triggers a redirect — a failed fetch (offline, server restarting) never does
- the redirect carries `?next=`, so you land back where you were after signing in

Restarts (upgrades, config changes) are invisible: the session table is restored from disk and the page reconnects on its own.

## Admin page

A shield button appears at the bottom-right of the harness UI once you are signed in. It opens `/__guard/admin` (bookmark the URL if you prefer):

- change the password (the current one is required)
- session lifetime, lockout threshold/duration, page title, repository link — **applied on save**
- listen host/port — marked "takes effect after restart"
- live session list (source IP, browser, last activity): kick one device, or sign out everywhere

Anonymous visitors are redirected to the login page with no `next` echo, and the login page does not advertise the admin path.

**Why not a harness settings page instead:** that requires a `dsh.client` bundle (React plus a build step), which takes the plugin from ~30 KB to hundreds of KB, adds a build toolchain to a project that otherwise has none, and ties it to the harness slot API while that API is still moving — a version mismatch can blank the whole settings screen. A standalone page stays build-free and survives harness upgrades.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `502 upstream unreachable` | The harness is down, or `listenPort` collides with it |
| Keeps bouncing to `/login` | No session cookie; make sure you use one address (an HTTP cookie is not shared with HTTPS) |
| Login succeeds then bounces back | Clock skew between the client and the host |
| `randomUUID is not a function` | `polyfill` is disabled |
| LAN can still reach the harness port | The harness is not bound to loopback — see the startup warning |

All log lines are prefixed `[dsh-web-guard]` and share the harness's journal stream. Successful requests are not logged (the Web UI polls constantly); only failures and slow requests are.

## Development

```bash
# shadow instance: serves the real profile without touching it
dsh --profile web --patch ./dev.yml --host 127.0.0.1 --port 3099 --no-open

# e2e against a running gate
GUARD_URL=http://127.0.0.1:3081 GUARD_PASSWORD=... node test/e2e.mjs
```

`dev.yml` only needs the `insert` row shown above with `listenHost: 127.0.0.1` and a distinct port.

The plugin uses only public harness APIs: `webServer.register`, `webServer.tapIndex`, `webServer.getOrigin`, and `connection.authenticatedUrl`. No monkey-patching, no source modification.

## Companion plugin

DSH's built-in document preview cannot play video — opening an `.mp4` in the sidebar says the format is unsupported. [dsh-video-preview](https://github.com/lvxianchao/dsh-video-preview) adds a streaming video renderer for the same sidebar: `mp4` / `webm` / `mov`, byte-range seeking, no size cap.

```bash
dsh plugin --profile web add @lvxianchao/dsh-video-preview
```

The two plugins are independent — install either or both.

## Sponsor

If dsh-web-guard saved you some setup time, a coffee is welcome:

- ☕ **[Afdian](https://afdian.com/a/lvxianchao)** — mainland China, WeChat / Alipay
- 🌍 **[Ko-fi](https://ko-fi.com/lvxianchao)** — international, PayPal

<details>
<summary>WeChat tip QR</summary>

<p align="center"><img src="https://raw.githubusercontent.com/lvxianchao/dsh-web-guard/main/docs/wechat.jpg" width="220" alt="WeChat tip QR"></p>

</details>

## License

MIT
