# AGENTS.md — dsh-web-guard

A password gate for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) Web UI. One plugin that also removes the four things that break when a DSH Web UI leaves loopback: the `/api` 403 every reverse proxy causes, the per-process `?token=`, the token in the journal, and the `crypto.randomUUID` crash on plain HTTP.

| | |
| --- | --- |
| Package | `@lvxianchao/dsh-web-guard` (npm, MIT) |
| Current version | 2.1.1 |
| Runtime | Node.js >= 22.19, no runtime dependencies, no build step |
| Install target | a DSH profile's bundle list (`web` by default) |

## Install

```bash
dsh plugin --profile web add @lvxianchao/dsh-web-guard
dsh plugin --profile web add "github:lvxianchao/dsh-web-guard"      # from GitHub
dsh plugin --profile web add /path/to/dsh-web-guard                 # from a checkout
sudo systemctl restart dsh-web                                      # adapt to the deployment
```

The package declares `dsh.bundle`, so the guard row mounts automatically. Do not add a `cordis.patch.yml` row to install it — only to override config.

## Verify

```bash
# the gate listens on 3081; anonymous requests get redirected to /login
curl -si http://127.0.0.1:3081/ | head -3

# the gate reports health
curl -s http://127.0.0.1:3081/__guard/health

# failures and slow requests are logged with this prefix
journalctl -u dsh-web --since -5min | grep '\[dsh-web-guard\]'
```

On first start a password is generated, printed once to the terminal, and stored hashed in `<profile>/data/dsh-web-guard.json` (mode `0600`). The real end-to-end check is a browser login on `/login`.

## Configure

Profile patch: `~/.dsh/profiles/web/cordis.patch.yml`.

```yaml
- id: guard
  config:
    listenHost: '0.0.0.0'
    listenPort: 3081
    passwordHash: 'scrypt$...'   # node -e "import('./lib/auth.js').then(m=>console.log(m.hashPassword(process.argv[1])))" 'pw'
    sessionDays: 7
    maxAttempts: 5
    lockMinutes: 5
    tls: { certFile: /path/fullchain.pem, keyFile: /path/privkey.pem }
```

A profile patch **replaces the whole `config` object**, so restate every key you need. Full key table: README.md → Configuration.

## Safety rules (read before changing anything)

- **Never remove or disable this plugin on a deployment that is exposed beyond loopback.** The gate is the only way in: `dsh plugin remove`, deleting the bundle entry, or `disabled: true` stops port 3081 from listening while DSH keeps running. See README.md → "⚠️ This is the front door".
- The harness itself must listen on loopback; otherwise clients bypass the gate through the LAN address.
- One password, one privilege level. Do not present or implement it as multi-user auth.
- The session cache holds SHA-256 digests, never tokens — keep it that way.

## Develop

```bash
git checkout dev                 # main only ever carries released code
dsh --profile web --patch ./dev.yml --host 127.0.0.1 --port 3099 --no-open
GUARD_URL=http://127.0.0.1:3081 GUARD_PASSWORD=... node test/e2e.mjs
```

`test/e2e.mjs` submits one wrong password on purpose, so run it against a test instance when `maxAttempts` is low.

Release: bump `package.json` + add a CHANGELOG entry, merge `dev` into `main` with `--ff-only`, tag `v<version>`, push the tag. CI publishes to npm with provenance and cuts the GitHub release; a tag that disagrees with `package.json` fails the run.

## Repository map

| Path | Role |
| --- | --- |
| `lib/index.js` | plugin body: request router, login/logout, admin routes, forwarding loop |
| `lib/proxy.js` | upstream forwarding and the `Host` / `Origin` loopback rewrite |
| `lib/auth.js` | scrypt password hashing and the session table (SHA-256 digests, persisted cache) |
| `lib/page.js`, `lib/i18n.js` | login / sign-out / admin HTML and en+zh strings |
| `lib/admin.js` | admin page template |
| `lib/inject.js`, `lib/polyfill.js` | injected client probe (`/__guard/session`) and the secure-context polyfill |
| `test/e2e.mjs` | live checks against a running gate (needs `GUARD_PASSWORD`) |
| `dev.yml` | shadow-instance overlay for local development |

Companion plugin: [dsh-video-preview](https://github.com/lvxianchao/dsh-video-preview) (streaming video preview for the same sidebar; independent install).
