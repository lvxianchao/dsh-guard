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
import { injectPolyfill } from './polyfill.js'

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

/** Resolve the persisted guard state file (password hash + secret). */
function statePath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'dsh-guard.json')
}

function readState() {
  try {
    return JSON.parse(readFileSync(statePath(), 'utf8'))
  } catch {
    return {}
  }
}

function writeState(state) {
  const path = statePath()
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
  const cfg = { ...DEFAULTS, ...config }
  // Write straight to the process streams: cordis loggers can swallow lines
  // depending on level, and the generated password must never be lost.
  const log = (line) => console.log(`[dsh-guard] ${line}`)
  const warn = (line) => console.error(`[dsh-guard] ${line}`)

  // ── password resolution: hash > plaintext > generated-and-persisted ────────
  const state = readState()
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
    writeState({ ...state, passwordHash, createdAt: new Date().toISOString() })
    log(`no password configured — generated one and saved to ${statePath()}`)
    log(`PASSWORD: ${generated}`)
  }

  const sessions = new SessionStore({
    sessionDays: Number(cfg.sessionDays),
    maxAttempts: Number(cfg.maxAttempts),
    lockMinutes: Number(cfg.lockMinutes),
  })

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
  async function handleLogin(req, res) {
    const ip = clientIp(req)
    if (sessions.isLocked(ip)) {
      return html(res, 429, loginPage({ title: cfg.title, locked: true, repo: cfg.repo }))
    }
    if (!originAllowed(req)) {
      return html(res, 403, loginPage({ title: cfg.title, error: '请求来源不合法', repo: cfg.repo }))
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
        error: left > 0 ? '密码不正确' : '尝试次数过多，请稍后再试',
        next: safeNext,
        repo: cfg.repo,
      }))
    }
    sessions.clearFailures(ip)
    const token = sessions.issue(ip, String(req.headers['user-agent'] ?? ''))
    setSessionCookie(res, token)
    log(`login ok from ${ip}`)
    redirect(res, safeNext)
  }

  async function handler(req, res) {
    const url = new URL(req.url ?? '/', 'http://guard.invalid')
    const path = url.pathname

    if (path === '/__guard/health') return json(res, 200, { ok: true, service: 'dsh-guard' })

    if (path === '/login' && req.method === 'GET') {
      if (sessionOf(req)) return redirect(res, '/')
      return html(res, 200, loginPage({ title: cfg.title, next: url.searchParams.get('next') ?? '/', repo: cfg.repo }))
    }
    if (path === '/login' && req.method === 'POST') return handleLogin(req, res)

    if (path === '/logout') {
      const s = sessionOf(req)
      if (s) sessions.revoke(s.token)
      clearSessionCookie(res)
      return html(res, 200, logoutPage({ title: cfg.title }))
    }

    if (!sessionOf(req)) {
      if (path.startsWith('/api')) return json(res, 401, { error: 'unauthorized', login: '/login' })
      const next = encodeURIComponent(url.pathname + url.search)
      return redirect(res, `/login?next=${next}`)
    }

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
      return ctx.webServer.tapIndex(injectPolyfill)
    }
    return undefined
  }, 'dsh-guard: uuid polyfill')

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
