/**
 * On-disk state owned by one profile.
 *
 * `data/dsh-web-guard.json` next to the profile patch holds the password hash
 * and the settings the operator edits in the admin surface. The session cache
 * lives beside it, keyed by listener port.
 */
export interface PersistedSettings {
  sessionDays: number
  maxAttempts: number
  lockMinutes: number
  listenHost: string
  listenPort: number
}

export interface PersistedState {
  passwordHash?: string
  createdAt?: string
  settings?: Partial<PersistedSettings>
}

/** One restored session row (the cache stores digest metadata, never tokens). */
export interface SessionRecord {
  id: string
  digest: string
  ip: string
  ua: string
  createdAt: number
  lastSeen: number
}
