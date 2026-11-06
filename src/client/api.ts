/**
 * Thin JSON client for the guard API described by `src/shared/api.ts`.
 *
 * The page lives on the same origin as the harness, so the guard session
 * cookie is carried by `credentials: 'same-origin'`. Every function returns a
 * discriminated result instead of throwing: a slot component that throws
 * blanks its entry in the settings panel, and a failed fetch is a normal UI
 * state (inline message plus retry), not an exception.
 */
import {
  GUARD_API,
  type ChangePasswordRequest,
  type GuardErrorCode,
  type GuardOkResponse,
  type GuardStateResponse,
  type KickRequest,
  type UpdateSettingsRequest,
  type UpdateSettingsResponse,
} from '../shared/api'

/** Error code carried by a failed request. */
export type GuardApiError = GuardErrorCode | 'network_error' | 'unknown_error'

/** Failed result: a known contract code or a transport-level failure. */
export interface GuardFailure {
  ok: false
  error: GuardApiError
  /** Field name when the server attributed the failure to one input. */
  field?: string
}

/** Discriminated result of one API call. */
export type GuardResult<T> = { ok: true; data: T } | GuardFailure

/**
 * Contract codes this client understands. Kept as a runtime set because a
 * newer server may return a code this build does not know; such a response is
 * reported as `unknown_error` instead of being surfaced verbatim.
 */
const ERROR_CODES: ReadonlySet<string> = new Set<GuardErrorCode>([
  'unauthorized',
  'forbidden',
  'invalid_body',
  'invalid_field',
  'wrong_current',
  'too_short',
  'mismatch',
  'not_found',
  'method_not_allowed',
  'kick_missing',
  'restart_required',
])

/** Narrow an unknown value to a JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether `value` is one of the contract error codes. */
function isErrorCode(value: unknown): value is GuardErrorCode {
  return typeof value === 'string' && ERROR_CODES.has(value)
}

/**
 * Perform one JSON request and normalize the outcome.
 * @param path - API route from {@link GUARD_API}.
 * @param init - fetch options; `credentials` is forced to same-origin.
 * @returns the decoded success payload or a normalized failure.
 */
async function request<T>(path: string, init: RequestInit): Promise<GuardResult<T>> {
  let response: Response
  try {
    response = await fetch(path, { ...init, credentials: 'same-origin' })
  } catch {
    // Offline, DNS, TLS, or a browser-level abort: never throw at the caller.
    return { ok: false, error: 'network_error' }
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = undefined
  }

  if (!isRecord(payload) || payload.ok !== true) {
    const error = isRecord(payload) && isErrorCode(payload.error) ? payload.error : 'unknown_error'
    const field = isRecord(payload) && typeof payload.field === 'string' ? payload.field : undefined
    return field === undefined ? { ok: false, error } : { ok: false, error, field }
  }

  return { ok: true, data: payload as unknown as T }
}

/** POST a JSON body; the guard rejects mutating calls without that content type. */
function post<T>(path: string, body: unknown): Promise<GuardResult<T>> {
  let serialized: string
  try {
    serialized = JSON.stringify(body)
  } catch {
    // Only reachable with a circular payload, which this module never builds.
    return Promise.resolve({ ok: false, error: 'invalid_body' })
  }
  return request<T>(path, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: serialized,
  })
}

/**
 * Read the current settings and live sessions.
 * @returns the state payload or a normalized failure (401 when signed out).
 */
export function fetchGuardState(): Promise<GuardResult<GuardStateResponse>> {
  return request<GuardStateResponse>(GUARD_API.state, {
    method: 'GET',
    headers: { accept: 'application/json' },
  })
}

/**
 * Persist a subset of the settings. Omitted fields keep their current value,
 * per the contract, so the policy and listener forms can save independently.
 * @param update - fields to change.
 * @returns the effective settings plus whether a restart is required.
 */
export function updateGuardSettings(update: UpdateSettingsRequest): Promise<GuardResult<UpdateSettingsResponse>> {
  return post<UpdateSettingsResponse>(GUARD_API.settings, update)
}

/**
 * Change the login password.
 * @param change - current password plus the new password twice.
 */
export function changeGuardPassword(change: ChangePasswordRequest): Promise<GuardResult<GuardOkResponse>> {
  return post<GuardOkResponse>(GUARD_API.password, change)
}

/**
 * Revoke one session row.
 * @param kick - id from {@link GuardStateResponse.sessions}.
 */
export function kickGuardSession(kick: KickRequest): Promise<GuardResult<GuardOkResponse>> {
  return post<GuardOkResponse>(GUARD_API.kick, kick)
}

/** Revoke every session, including the one this page is using. */
export function signOutAllDevices(): Promise<GuardResult<GuardOkResponse>> {
  return post<GuardOkResponse>(GUARD_API.logoutAll, {})
}
