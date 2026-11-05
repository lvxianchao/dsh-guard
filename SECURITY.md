# Security policy

## Supported versions

The latest release on `main`. Fixes ship in the next release, not in older versions.

| Version | Supported |
| --- | --- |
| 2.x (latest) | ✅ |
| older | ❌ |

## Report a vulnerability

Use GitHub's **private vulnerability reporting** — do not open a public issue:

<https://github.com/lvxianchao/dsh-web-guard/security/advisories/new>

Please include the affected version, the deployment topology (guard terminating TLS itself, or behind NPM / Caddy / Traefik), reproduction steps and the impact you see. This is a spare-time project with no bug bounty; an initial reply is best effort, usually within about a week.

## What this plugin is responsible for

- Password storage and verification: scrypt with a random salt, the portable `scrypt$N$r$p$salt$key` form; the plaintext is never stored.
- Session issuance, revocation and the on-disk cache (`<profile>/data/dsh-web-guard-sessions-<port>.json`): only SHA-256 digests are stored, never tokens; file mode `0600`, atomic tmp+rename.
- Cookie attributes: `HttpOnly`, `SameSite=Lax`, and `Secure` whenever TLS is on.
- CSRF posture: a same-hostname `Origin` check on state-changing form posts, plus `SameSite=Lax`.
- The `Host` / `Origin` rewrite that satisfies the harness browser-trust fence. A mistake there must narrow access, never widen it.
- The login, sign-out and admin surfaces (`/login`, `/logout`, `/__guard/admin`, `/__guard/session`, `/__guard/health`) and the TLS listener when `tls` is configured.

## Out of scope

- DSH itself, its `?token=` mode, and the permissions of the agent behind the gate. **Anyone who gets past the gate can execute code on the host by design** — that is what the harness is, not a flaw in the gate.
- Multi-user access control. One password, one privilege level: no accounts, roles, 2FA or per-user audit.
- The reverse proxy's own security (TLS termination, headers, rate limiting) when one is used.
- Weak or reused passwords, and deployments deliberately exposed over plain HTTP.
- Resource exhaustion by an already-authenticated client.
- The `polyfill` shim, which only recreates `crypto.randomUUID` in non-secure contexts.

## Deployment notes

- Keep the harness itself bound to loopback. The plugin warns at startup when it is not, because a LAN or public listener lets clients bypass the gate.
- Use TLS: either the plugin's own `tls.certFile` / `tls.keyFile` or a reverse proxy in front of it.
- Have an out-of-band recovery path (hypervisor console, or SSH that does not traverse the gate) **before** exposing the address to the internet. See README.md → "If you closed it by accident".
- The password hash and session cache live under the profile's `data/` directory; back up the hash if you need to restore the password.

## Dependencies

None at runtime — Node standard library only. There is no production `npm install` step and no third-party code in the request path.
