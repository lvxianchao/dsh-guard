/**
 * The JSON contract between the server half of dsh-web-guard and the React
 * settings page in the client bundle. Both halves compile against this file, so
 * a shape change breaks the build instead of the settings page.
 *
 * Authentication is the ordinary session cookie: the native page lives on the
 * same origin as the harness, so `fetch` with `credentials: 'same-origin'`
 * carries it. Every mutating call is checked against the request `Origin`, and
 * the JSON content type forces a CORS preflight, which makes cross-site form
 * posts from another origin impossible.
 */

/** Route table, relative to the deployment origin. */
export const GUARD_API = {
  state: '/__guard/api/state',
  settings: '/__guard/api/settings',
  password: '/__guard/api/password',
  kick: '/__guard/api/kick',
  logoutAll: '/__guard/api/logout-all',
} as const

export interface GuardSettingsView {
  sessionDays: number
  maxAttempts: number
  lockMinutes: number
  listenHost: string
  listenPort: number
  /** Product label shown on the login page. */
  title: string
  /** Repository link shown on the login page. */
  repo: string
}

export interface SessionView {
  /** Stable id for the revoke button; the current session carries `current: true`. */
  id: string
  ip: string
  ua: string
  createdAt: number
  lastSeen: number
  current: boolean
}

export interface GuardStateResponse {
  ok: true
  settings: GuardSettingsView
  sessions: SessionView[]
  /** Configured listener host/port differ from the running binding. */
  restartRequired: boolean
}

export type GuardErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_body'
  | 'invalid_field'
  | 'wrong_current'
  | 'too_short'
  | 'mismatch'
  | 'not_found'
  | 'method_not_allowed'
  | 'kick_missing'
  | 'restart_required'

export interface GuardErrorResponse {
  ok: false
  error: GuardErrorCode
  /** Field name for per-field messages, when the error is about one input. */
  field?: string
  /** Server-side detail (never shown verbatim to the operator). */
  detail?: string
}

export interface UpdateSettingsRequest {
  sessionDays?: number
  maxAttempts?: number
  lockMinutes?: number
  listenHost?: string
  listenPort?: number
}

export interface UpdateSettingsResponse {
  ok: true
  settings: GuardSettingsView
  /** Listener host/port changed: the new binding applies after a restart. */
  restartRequired: boolean
}

export interface ChangePasswordRequest {
  current: string
  next: string
  confirm: string
}

export interface KickRequest {
  id: string
}

/** Success shape for password change, kick and logout-all. */
export interface GuardOkResponse {
  ok: true
}
