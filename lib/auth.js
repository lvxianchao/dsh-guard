/**
 * Password verification and session storage for dsh-web-guard.
 *
 * Design notes:
 * - Passwords are stored as scrypt `scrypt$N$r$p$salt$key` (same shape the
 *   Hermes dashboard uses) so a hash can be pasted into config.
 * - Sessions live in memory: the plugin restarts with dsh, and a restart
 *   should force a fresh login anyway. Tokens are stored hashed, so a heap
 *   dump does not hand out live sessions.
 * - Every session carries its own expiry and last-seen stamp; the cookie
 *   lifetime is fixed at issue time, the server side slides on activity.
 */
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto'

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
  constructor({ sessionDays = 7, maxAttempts = 5, lockMinutes = 5 } = {}) {
    this.sessionMs = Math.max(0, sessionDays) * 24 * 60 * 60 * 1000
    this.maxAttempts = Math.max(1, maxAttempts)
    this.lockMs = Math.max(1, lockMinutes) * 60 * 1000
    /** @type {Map<string, {createdAt:number,lastSeen:number,ip:string,ua:string}>} */
    this.sessions = new Map()
    /** @type {Map<string, {fails:number,until:number}>} */
    this.failures = new Map()
    this.timer = setInterval(() => this.sweep(), 10 * 60 * 1000)
    this.timer.unref?.()
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
      return undefined
    }
    row.lastSeen = now
    return row
  }

  revoke(token) {
    if (typeof token === 'string' && token.length > 0) this.sessions.delete(sha256(token))
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
  }

  sweep() {
    const now = Date.now()
    const limit = this.sessionMs === 0 ? 12 * 60 * 60 * 1000 : this.sessionMs
    for (const [key, row] of this.sessions) {
      if (now - row.lastSeen > limit) this.sessions.delete(key)
    }
    for (const [ip, row] of this.failures) {
      if (row.until > 0 && row.until < now) this.failures.delete(ip)
    }
  }

  dispose() {
    clearInterval(this.timer)
    this.sessions.clear()
    this.failures.clear()
  }
}
