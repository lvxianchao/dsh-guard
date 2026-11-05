/**
 * Password verification and session storage for dsh-web-guard.
 *
 * Design notes:
 * - Passwords are stored as scrypt `scrypt$N$r$p$salt$key` (same shape the
 *   Hermes dashboard uses) so a hash can be pasted into config.
 * - Sessions are hashed before they reach memory *and* the on-disk cache, so
 *   neither a heap dump nor the state file can mint a working cookie. The
 *   cache exists so a restart (upgrade, config change) does not sign everyone
 *   out; revocation still goes through the admin page, and a session that
 *   expired while the process was down is dropped on load.
 * - Every session carries its own expiry and last-seen stamp; the cookie
 *   lifetime is fixed at issue time, the server side slides on activity.
 */
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEYLEN = 32

/** Hash a plaintext password into the portable scrypt string form. */
export function hashPassword(password, salt = randomBytes(16)) {
  const key = scryptSync(password, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: 64 * 1024 * 1024 })
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${key.toString('base64')}`
}

/** Verify a password against either the scrypt string or a bare plaintext. */
export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string' || stored.length === 0) return false
  if (!stored.startsWith('scrypt$')) {
    // Plaintext config: constant-time compare on equal-length buffers.
    const a = Buffer.from(password)
    const b = Buffer.from(stored)
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  }
  const parts = stored.split('$')
  if (parts.length !== 6) return false
  const [, n, r, p, saltB64, keyB64] = parts
  let expected
  try {
    expected = Buffer.from(keyB64, 'base64')
  } catch {
    return false
  }
  if (expected.length === 0) return false
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

/** In-memory session table with per-IP failure accounting. */
export class SessionStore {
  /**
   * @param {object} options
   * @param {number} options.sessionDays - session lifetime in days; 0 = browser session only
   * @param {number} options.maxAttempts - failures before a temporary lock
   * @param {number} options.lockMinutes - lock duration in minutes
   */
  constructor({ sessionDays = 7, maxAttempts = 5, lockMinutes = 5, file } = {}) {
    this.sessionMs = Math.max(0, sessionDays) * 24 * 60 * 60 * 1000
    this.maxAttempts = Math.max(1, maxAttempts)
    this.lockMs = Math.max(1, lockMinutes) * 60 * 1000
    /** @type {Map<string, {createdAt:number,lastSeen:number,ip:string,ua:string}>} */
    this.sessions = new Map()
    /** @type {Map<string, {fails:number,until:number}>} */
    this.failures = new Map()
    this.file = typeof file === 'string' && file.length > 0 ? file : ''
    this.persistTimer = null
    this.timer = setInterval(() => this.sweep(), 10 * 60 * 1000)
    this.timer.unref?.()
  }

  /**
   * Restore the table a previous process wrote. A missing or corrupt file is
   * treated as "no sessions" — a damaged cache must never block sign-in.
   */
  load() {
    if (!this.file) return
    let data
    try {
      data = JSON.parse(readFileSync(this.file, 'utf8'))
    } catch {
      return
    }
    if (data === null || typeof data !== 'object' || data.version !== 1) return
    if (data.sessions === null || typeof data.sessions !== 'object') return
    const now = Date.now()
    const limit = this.sessionMs === 0 ? 12 * 60 * 60 * 1000 : this.sessionMs
    for (const [key, row] of Object.entries(data.sessions)) {
      if (!/^[0-9a-f]{64}$/.test(key)) continue
      if (typeof row?.createdAt !== 'number' || typeof row?.lastSeen !== 'number') continue
      if (now - row.lastSeen > limit) continue
      this.sessions.set(key, {
        createdAt: row.createdAt,
        lastSeen: row.lastSeen,
        ip: typeof row.ip === 'string' ? row.ip : '',
        ua: typeof row.ua === 'string' ? row.ua : '',
      })
    }
  }

  /** Write the table atomically (tmp + rename); disk problems never block auth. */
  persist() {
    if (!this.file) return
    try {
      const sessions = {}
      for (const [key, row] of this.sessions) sessions[key] = row
      mkdirSync(dirname(this.file), { recursive: true })
      const tmp = `${this.file}.${process.pid}.tmp`
      writeFileSync(tmp, JSON.stringify({ version: 1, savedAt: Date.now(), sessions }), { mode: 0o600 })
      renameSync(tmp, this.file)
    } catch {
      // Read-only data dir or full disk: this process keeps working from memory.
    }
  }

  /** Coalesce a burst of changes into one write. */
  touch() {
    if (!this.file || this.persistTimer !== null) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      this.persist()
    }, 500)
    this.persistTimer.unref?.()
  }

  /** Whether this client is currently locked out. */
  isLocked(ip) {
    const row = this.failures.get(ip)
    if (!row) return false
    if (row.until === 0) return false          // below the threshold: keep counting
    if (row.until > Date.now()) return true
    this.failures.delete(ip)                    // lock expired
    return false
  }

  /** Record a failed attempt; returns the remaining attempts before lock. */
  recordFailure(ip) {
    const row = this.failures.get(ip) ?? { fails: 0, until: 0 }
    row.fails += 1
    if (row.fails >= this.maxAttempts) {
      row.until = Date.now() + this.lockMs
      row.fails = 0
    }
    this.failures.set(ip, row)
    return Math.max(0, this.maxAttempts - row.fails)
  }

  clearFailures(ip) {
    this.failures.delete(ip)
  }

  /** Create a session and return the raw token (only ever held by the client). */
  issue(ip, ua) {
    const token = randomBytes(32).toString('base64url')
    const now = Date.now()
    this.sessions.set(sha256(token), { createdAt: now, lastSeen: now, ip, ua })
    this.touch()
    return token
  }

  /** Resolve a token to its session, sliding last-seen. */
  resolve(token) {
    if (typeof token !== 'string' || token.length === 0) return undefined
    const key = sha256(token)
    const row = this.sessions.get(key)
    if (!row) return undefined
    const now = Date.now()
    const limit = this.sessionMs === 0 ? 12 * 60 * 60 * 1000 : this.sessionMs
    if (now - row.lastSeen > limit) {
      this.sessions.delete(key)
      this.touch()
      return undefined
    }
    row.lastSeen = now
    this.touch()
    return row
  }

  revoke(token) {
    if (typeof token !== 'string' || token.length === 0) return
    if (this.sessions.delete(sha256(token))) this.touch()
  }

  /** List live sessions with a short opaque id (the hashed key prefix). */
  list() {
    const now = Date.now()
    const limit = this.sessionMs === 0 ? 12 * 60 * 60 * 1000 : this.sessionMs
    const out = []
    for (const [key, row] of this.sessions) {
      if (now - row.lastSeen > limit) continue
      out.push({ id: key.slice(0, 16), ip: row.ip, ua: row.ua, createdAt: row.createdAt, lastSeen: row.lastSeen })
    }
    return out.sort((a, b) => b.lastSeen - a.lastSeen)
  }

  /** Drop one session by the id returned from {@link list}. */
  removeById(id) {
    if (typeof id !== 'string') return false
    for (const key of this.sessions.keys()) {
      if (key.slice(0, 16) === id) {
        this.sessions.delete(key)
        this.touch()
        return true
      }
    }
    return false
  }

  /** Id of the session owning this raw token, for "current" highlighting. */
  idOf(token) {
    if (typeof token !== 'string' || token.length === 0) return ''
    return sha256(token).slice(0, 16)
  }

  revokeAll() {
    this.sessions.clear()
    this.touch()
  }

  sweep() {
    const now = Date.now()
    let dropped = false
    const limit = this.sessionMs === 0 ? 12 * 60 * 60 * 1000 : this.sessionMs
    for (const [key, row] of this.sessions) {
      if (now - row.lastSeen > limit) {
        this.sessions.delete(key)
        dropped = true
      }
    }
    for (const [ip, row] of this.failures) {
      if (row.until > 0 && row.until < now) this.failures.delete(ip)
    }
    if (dropped) this.touch()
  }

  dispose() {
    clearInterval(this.timer)
    if (this.persistTimer !== null) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
    }
    this.persist()
    this.sessions.clear()
    this.failures.clear()
  }
}
