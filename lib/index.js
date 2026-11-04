/**
 * dsh-guard — a password-gated front door for the DeepSeek Harness Web UI.
 *
 * Why this exists: the harness authenticates browsers with a per-process launch
 * token that is only printed to the operator's terminal, and its /api fence
 * rejects any proxy that rewrites Host. Both are correct for a local tool and
 * awkward for a service. This plugin listens on its own port, authenticates a
 * human with one password, then forwards to the loopback listener with Host and
 * Origin rewritten — which the fence accepts by design — while injecting the
 * harness cookie the browser never sees.
 *
 * Zero runtime dependencies: node standard library only, so `dsh plugin add`
 * works without a build step and without a version-pinned toolchain.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { createListener, forward, forwardUpgrade, upstreamAgent } from './proxy.js'
import { hashPassword, verifyPassword, SessionStore } from './auth.js'
import { loginPage, logoutPage } from './page.js'
import { adminPage } from './admin.js'
import { injectUi } from './inject.js'
import { createLocaleReader, normalize, t } from './i18n.js'

export const name = 'dsh-guard'
export const inject = ['webServer', 'connection']

const COOKIE = 'dsh_guard'
const MAX_FORM = 8 * 1024
const MAX_BODY = 8 * 1024

const DEFAULTS = {
  listenHost: '0.0.0.0',
  listenPort: 3081,
  sessionDays: 7,
  polyfill: true,
  title: 'DeepSeek Harness Guard',
  repo: 'https://github.com/lvxianchao/dsh-guard',
  password: '',
  passwordHash: '',
  maxAttempts: 5,
  lockMinutes: 5,
  tls: null,
  publicUrl: '',
}

/**
 * Guard state (password hash + admin-page settings) belongs to one profile:
 * several profiles can run this plugin and must not share a port or a password.
 * Reading prefers the profile-local file, then the legacy
 * $DSH_HOME/dsh-guard.json written by earlier versions; writes always use the
 * profile-local path.
 */
function legacyStatePath() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dsh-guard.json')
}

function statePath(profileDir) {
  return join(profileDir, 'data', 'dsh-guard.json')
}

function readState(profileDir) {
  for (const path of [statePath(profileDir), legacyStatePath()]) {
    try {
      return JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      /* try the next location */
    }
  }
  return {}
}

function writeState(profileDir, state) {
  const path = statePath(profileDir)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(state, null, 2), { mode: 0o600 })
}

/** Generate a memorable-but-strong password (base32-ish, no ambiguous chars). */
function randomPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(16)
  let out = ''
  for (let i = 0; i < 16; i++) out += alphabet[bytes[i] % alphabet.length]
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}`
}

function parseCookies(header) {
  const out = {}
  if (typeof header !== 'string') return out
  for (const part of header.split(';')) {
    const at = part.indexOf('=')
    if (at === -1) continue
    out[part.slice(0, at).trim()] = decodeURIComponent(part.slice(at + 1).trim())
  }
  return out
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0].trim()
  return req.socket.remoteAddress ?? 'unknown'
}

function send(res, status, headers, body) {
  res.writeHead(status, headers)
  res.end(body)
}

const json = (res, status, payload) => send(res, status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, JSON.stringify(payload))
const html = (res, status, body) => send(res, status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, body)
const redirect = (res, location) => send(res, 302, { location, 'cache-control': 'no-store' }, '')

/** Same-origin check for state-changing form posts.
 *
 * Compares hostnames only: a TLS-terminating proxy commonly forwards `Host`
 * without the public port while the browser's Origin still carries it, so a
 * strict host:port comparison would reject every proxied login. SameSite=Lax
 * on the session cookie remains the primary CSRF defence.
 */
function originAllowed(req) {
  const origin = req.headers.origin
  if (origin === undefined) return true // non-browser client; password still required
  try {
    const parsed = new URL(origin)
    const host = String(req.headers.host ?? '').toLowerCase()
    const hostname = host.includes(']') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0]
    return parsed.hostname.toLowerCase() === hostname
  } catch {
    return false
  }
}

export function apply(ctx, config = {}) {
  // Precedence: file-managed settings (written by the admin page) > plugin
  // config in cordis.patch.yml > built-in defaults.
  const patchPath = ctx.profileContext?.patchPath
    ?? ctx.get?.('profileContext')?.patchPath
    ?? join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'profiles', 'web', 'cordis.patch.yml')
  const profileDir = dirname(patchPath)

  const persisted = readState(profileDir).settings ?? {}
  const cfg = { ...DEFAULTS, ...config, ...persisted }
  // Write straight to the process streams: cordis loggers can swallow lines
  // depending on level, and the generated password must never be lost.
  const log = (line) => console.log(`[dsh-guard] ${line}`)
  const warn = (line) => console.error(`[dsh-guard] ${line}`)

  // ── password resolution: hash > plaintext > generated-and-persisted ────────
  const state = readState(profileDir)
  let passwordHash = cfg.passwordHash || ''
  let generated = ''
  if (!passwordHash && cfg.password) {
    passwordHash = hashPassword(String(cfg.password))
    log('password taken from plugin config')
  }
  if (!passwordHash) {
    passwordHash = state.passwordHash || ''
  }
  if (!passwordHash) {
    generated = randomPassword()
    passwordHash = hashPassword(generated)
    writeState(profileDir, { ...state, passwordHash, createdAt: new Date().toISOString() })
    log(`no password configured — generated one and saved to ${statePath(profileDir)}`)
    log(`PASSWORD: ${generated}`)
  }

  const sessions = new SessionStore({
    sessionDays: Number(cfg.sessionDays),
    maxAttempts: Number(cfg.maxAttempts),
    lockMinutes: Number(cfg.lockMinutes),
  })

  // Locale follows the harness: its language picker writes `preference` into
  // the profile patch file. Uncached reads would hit the filesystem on every
  // request, so the file is polled at most every few seconds.
  // Event-driven: no filesystem work on the request path.
  const localeReader = createLocaleReader(patchPath)
  function localeFor(req) {
    const explicit = localeReader.get()
    if (explicit) return explicit
    const header = String(req?.headers?.['accept-language'] ?? '')
    return normalize(header.split(',')[0]?.trim()) || 'en'
  }

  const targetOrigin = ctx.webServer.getOrigin()
  const upstream = new URL(targetOrigin)
  const listenPort = Number(cfg.listenPort)
  if (listenPort === Number(upstream.port || 80)) {
    throw new Error(`dsh-guard: listenPort ${listenPort} collides with the harness listener ${targetOrigin}`)
  }
  const secureCookie = Boolean(cfg.tls?.certFile && cfg.tls?.keyFile)

  // ── harness cookie: exchanged in-process, never exposed to the browser ─────
  let cookieCache = { value: '', at: 0 }
  let inflight = null
  async function harnessCookie(force = false) {
    if (!force && cookieCache.value && Date.now() - cookieCache.at < 30 * 60 * 1000) return cookieCache.value
    if (inflight) return inflight
    inflight = (async () => {
      try {
        const url = ctx.connection.authenticatedUrl(`${targetOrigin}/`)
        const res = await fetch(url, { redirect: 'manual' })
        const parts = res.headers.getSetCookie?.() ?? []
        const value = parts.map((line) => line.split(';')[0]).filter(Boolean).join('; ')
        if (!value) throw new Error(`launch-token exchange returned ${res.status} without a cookie`)
        cookieCache = { value, at: Date.now() }
        log('harness session cookie exchanged')
        return value
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  function sessionOf(req) {
    const token = parseCookies(req.headers.cookie)[COOKIE]
    if (!token) return undefined
    const row = sessions.resolve(token)
    if (!row) return undefined
    return { token, row }
  }

  function setSessionCookie(res, token) {
    const attrs = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
    if (Number(cfg.sessionDays) > 0) attrs.push(`Max-Age=${Math.floor(Number(cfg.sessionDays) * 86400)}`)
    if (secureCookie) attrs.push('Secure')
    res.setHeader('set-cookie', attrs.join('; '))
  }

  function clearSessionCookie(res) {
    const attrs = [`${COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
    if (secureCookie) attrs.push('Secure')
    res.setHeader('set-cookie', attrs.join('; '))
  }

  // ── request handling ──────────────────────────────────────────────────────
  async function handleLogin(req, res, locale) {
    const ip = clientIp(req)
    if (sessions.isLocked(ip)) {
      return html(res, 429, loginPage({ title: cfg.title, locked: true, repo: cfg.repo, locale }))
    }
    if (!originAllowed(req)) {
      return html(res, 403, loginPage({ title: cfg.title, error: t(locale).errOrigin, repo: cfg.repo, locale }))
    }
    const body = await readBody(req).catch(() => '')
    const form = new URLSearchParams(body)
    const password = form.get('password') ?? ''
    const next = form.get('next') ?? '/'
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
    if (!verifyPassword(password, passwordHash)) {
      const left = sessions.recordFailure(ip)
      log(`login failed from ${ip} (${left} attempts left)`)
      return html(res, 401, loginPage({
        title: cfg.title,
        error: left > 0 ? t(locale).errWrong : t(locale).errLocked,
        next: safeNext,
        repo: cfg.repo,
        locale,
      }))
    }
    sessions.clearFailures(ip)
    const token = sessions.issue(ip, String(req.headers['user-agent'] ?? ''))
    setSessionCookie(res, token)
    log(`login ok from ${ip}`)
    redirect(res, safeNext)
  }

  // ── management routes (authenticated) ─────────────────────────────────────
  const clampInt = (value, min, max, fallback) => {
    const n = Number.parseInt(String(value ?? ''), 10)
    if (!Number.isFinite(n) || n < min || n > max) return fallback
    return n
  }

  function currentSettings() {
    return {
      sessionDays: cfg.sessionDays,
      maxAttempts: cfg.maxAttempts,
      lockMinutes: cfg.lockMinutes,
      repo: cfg.repo,          // footer link only — not editable from the UI
      listenHost: cfg.listenHost,
      listenPort: cfg.listenPort,
    }
  }

  function renderAdmin(res, session, { status = 200, notice = '', error = '', restartNote = '', locale = 'zh' } = {}) {
    const currentId = sessions.idOf(session.token)
    const rows = sessions.list().map((x) => ({ ...x, current: x.id === currentId }))
    const page = adminPage({
      settings: currentSettings(),
      sessions: rows,
      notice,
      error,
      restartNote,
      locale,
    })
    return html(res, status, page)
  }

  async function handleGuard(req, res, path, session, locale) {
    if (path === '/__guard/admin') {
      if (req.method === 'GET') return renderAdmin(res, session, { locale })
      if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' })
      if (!originAllowed(req)) return renderAdmin(res, session, { status: 403, error: t(locale).errOrigin, locale })

      const form = new URLSearchParams(await readBody(req).catch(() => ''))
      const problems = []

      // Password change: any of the three fields present means "intent to change".
      const cur = form.get('current') ?? ''
      const nextPassword = form.get('next') ?? ''
      const confirm = form.get('confirm') ?? ''
      let passwordChanged = false
      if (cur || nextPassword || confirm) {
        if (!verifyPassword(cur, passwordHash)) problems.push(t(locale).errCurrent)
        else if (nextPassword.length < 6) problems.push(t(locale).errShort)
        else if (nextPassword !== confirm) problems.push(t(locale).errMismatch)
        else {
          passwordHash = hashPassword(nextPassword)
          passwordChanged = true
        }
      }

      const sessionDays = clampInt(form.get('sessionDays'), 0, 365, cfg.sessionDays)
      const maxAttempts = clampInt(form.get('maxAttempts'), 1, 50, cfg.maxAttempts)
      const lockMinutes = clampInt(form.get('lockMinutes'), 1, 1440, cfg.lockMinutes)
      const listenHost = (form.get('listenHost') ?? '').trim().slice(0, 64) || cfg.listenHost
      const listenPort = clampInt(form.get('listenPort'), 1, 65535, cfg.listenPort)

      if (problems.length > 0) {
        return renderAdmin(res, session, { status: 400, error: problems.join(locale === 'zh' ? '；' : '; '), locale })
      }

      const restartNeeded = String(listenHost) !== String(cfg.listenHost) || Number(listenPort) !== Number(cfg.listenPort)

      // Apply the hot-reloadable values in place.
      cfg.sessionDays = sessionDays
      cfg.maxAttempts = maxAttempts
      cfg.lockMinutes = lockMinutes
      sessions.sessionMs = sessionDays * 24 * 60 * 60 * 1000
      sessions.maxAttempts = maxAttempts
      sessions.lockMs = lockMinutes * 60 * 1000

      writeState(profileDir, {
        ...readState(profileDir),
        passwordHash,
        settings: { sessionDays, maxAttempts, lockMinutes, listenHost, listenPort },
      })

      log(`settings updated${passwordChanged ? ' (password changed)' : ''}${restartNeeded ? ' — restart required for listener changes' : ''}`)
      return renderAdmin(res, session, {
        notice: passwordChanged ? t(locale).savedPassword : t(locale).saved,
        restartNote: restartNeeded ? t(locale).restartNote : '',
        locale,
      })
    }

    if (path === '/__guard/logout-all') {
      if (!originAllowed(req)) return json(res, 403, { error: 'forbidden' })
      sessions.revokeAll()
      clearSessionCookie(res)
      log('all sessions revoked from the admin page')
      return redirect(res, '/login')
    }

    if (path === '/__guard/kill') {
      if (!originAllowed(req)) return json(res, 403, { error: 'forbidden' })
      const form = new URLSearchParams(await readBody(req).catch(() => ''))
      const id = form.get('id') ?? ''
      const removed = sessions.removeById(id)
      log(`session revoked from the admin page: ${id.slice(0, 8)}… ${removed ? 'ok' : 'not found'}`)
      return renderAdmin(res, session, { notice: removed ? t(locale).kicked : t(locale).kickMissing, locale })
    }

    return json(res, 404, { error: 'not_found' })
  }

  async function handler(req, res) {
    const url = new URL(req.url ?? '/', 'http://guard.invalid')
    const path = url.pathname
    const locale = localeFor(req)

    if (path === '/__guard/health') return json(res, 200, { ok: true, service: 'dsh-guard' })

    if (path === '/login' && req.method === 'GET') {
      if (sessionOf(req)) return redirect(res, '/')
      return html(res, 200, loginPage({ title: cfg.title, next: url.searchParams.get('next') ?? '/', repo: cfg.repo, locale }))
    }
    if (path === '/login' && req.method === 'POST') return handleLogin(req, res, locale)

    if (path === '/logout') {
      const s = sessionOf(req)
      if (s) sessions.revoke(s.token)
      clearSessionCookie(res)
      return html(res, 200, logoutPage({ title: cfg.title, locale }))
    }

    const session = sessionOf(req)
    if (!session) {
      if (path.startsWith('/api')) return json(res, 401, { error: 'unauthorized', login: '/login' })
      // Management paths reveal nothing to anonymous visitors: no `next` echo.
      if (path.startsWith('/__guard/')) return redirect(res, '/login')
      const next = encodeURIComponent(url.pathname + url.search)
      return redirect(res, `/login?next=${next}`)
    }

    if (path.startsWith('/__guard/')) return handleGuard(req, res, path, session, locale)

    let cookie
    try {
      cookie = await harnessCookie()
    } catch (err) {
      warn(`harness cookie unavailable: ${err.message}`)
      return json(res, 503, { error: 'harness_unavailable', detail: err.message })
    }
    forward(req, res, { targetOrigin, cookie, agent: upstreamAgent, log })
  }

  function onUpgrade(req, socket, head) {
    if (!sessionOf(req)) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      return
    }
    harnessCookie()
      .then((cookie) => forwardUpgrade(req, socket, head, { targetOrigin, cookie, log }))
      .catch((err) => {
        warn(`upgrade blocked: ${err.message}`)
        socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n')
      })
  }

  // ── wiring ────────────────────────────────────────────────────────────────
  ctx.effect(() => {
    if (cfg.polyfill) {
      return ctx.webServer.tapIndex(injectUi)
    }
    return undefined
  }, 'dsh-guard: index transform')

  const listener = createListener({
    host: String(cfg.listenHost),
    port: listenPort,
    tlsCert: cfg.tls?.certFile || null,
    tlsKey: cfg.tls?.keyFile || null,
    handler,
    onUpgrade,
    log,
  })

  ctx.effect(() => {
    listener.listen().then(
      () => {
        log(`listening on ${secureCookie ? 'https' : 'http'}://${cfg.listenHost}:${listenPort} -> ${targetOrigin}`)
        const bind = ctx.webServer.config?.host
        if (typeof bind === 'string' && !isLoopback(bind)) {
          warn(`harness is bound to ${bind}; clients can bypass this gate by connecting there directly — bind it to 127.0.0.1`)
        }
      },
      (err) => warn(`listen failed on ${cfg.listenHost}:${listenPort}: ${err.message}`),
    )
    return () => {
      sessions.dispose()
      localeReader.dispose()
      listener.close()
    }
  }, 'dsh-guard: listener')

  return { stop: () => listener.close() }
}

function isLoopback(host) {
  return host === 'localhost' || host === '::1' || /^127\./.test(host)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_FORM) {
        reject(new Error('form too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}
