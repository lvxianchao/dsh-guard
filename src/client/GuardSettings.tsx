/**
 * Native DSH settings page ("Security") for dsh-web-guard.
 *
 * The page renders inside the harness React tree, so the shell has already
 * opened the settings panel and hands the section `close`; the plugin adds
 * only its own copy through the injected `t`. Every network call goes through
 * the defensive wrapper in `./api`, which never rejects: a failed request is
 * an inline message, because a throwing slot component blanks the whole
 * settings entry. Colours come exclusively from `--dsw-alias-*` host tokens
 * (see `./styles`), so the page follows light/dark and the host theme without
 * carrying a palette of its own.
 */
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, Dispatch, FormEvent, ReactElement, ReactNode, SetStateAction } from 'react'
import type { GuardSettingsView, GuardStateResponse, SessionView, UpdateSettingsResponse } from '../shared/api'
import {
  changeGuardPassword,
  fetchGuardState,
  kickGuardSession,
  signOutAllDevices,
  updateGuardSettings,
  type GuardFailure,
  type GuardResult,
} from './api'
import type { Translate } from './types'

/** One inline status line: success copy auto-dismisses, errors stay put. */
interface Notice {
  kind: 'ok' | 'error'
  text: string
}

/** Failed initial load: inline message plus whether re-authentication is required. */
interface LoadFailure {
  text: string
  unauthorized: boolean
}

/** Editable form state; numbers stay strings while the operator is typing. */
interface SettingsDraft {
  sessionDays: string
  maxAttempts: string
  lockMinutes: string
  listenHost: string
  listenPort: string
}

/** Allowed ranges mirror the server-side clamps in the JSON contract. */
const LIMITS = {
  sessionDays: { min: 0, max: 365 },
  maxAttempts: { min: 1, max: 50 },
  lockMinutes: { min: 1, max: 1440 },
  listenPort: { min: 1, max: 65535 },
} as const

/** How long a success notice stays up, in milliseconds. */
const NOTICE_MS = 4000

/** Locale keys for each contract error code. */
const ERROR_KEYS: Record<GuardFailure['error'], string> = {
  unauthorized: 'error.unauthorized',
  forbidden: 'error.forbidden',
  invalid_body: 'error.invalid_body',
  invalid_field: 'error.invalid_field',
  wrong_current: 'error.wrong_current',
  too_short: 'error.too_short',
  mismatch: 'error.mismatch',
  not_found: 'error.not_found',
  method_not_allowed: 'error.method_not_allowed',
  kick_missing: 'error.kick_missing',
  restart_required: 'error.restart_required',
  network_error: 'error.network',
  unknown_error: 'error.unknown',
}

/** Locale keys for the field names the server may report. */
const FIELD_KEYS: Record<string, string> = {
  sessionDays: 'field.sessionDays',
  maxAttempts: 'field.maxAttempts',
  lockMinutes: 'field.lockMinutes',
  listenHost: 'field.listenHost',
  listenPort: 'field.listenPort',
}

/** The empty draft shown while the first request is still in flight. */
const EMPTY_DRAFT: SettingsDraft = {
  sessionDays: '',
  maxAttempts: '',
  lockMinutes: '',
  listenHost: '',
  listenPort: '',
}

/** Props injected into the page: slot owner prop plus the bound translator. */
export interface GuardSettingsProps {
  /** Close the settings panel (unused today; part of the slot contract). */
  close?: () => void
  /** Bound translate function for the `webGuard` namespace. */
  t: Translate
}

/** Convert a possibly-missing numeric field to its input string. */
function textValue(value: number | string | undefined): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') return value
  return ''
}

/** Build an editable draft from the server's settings view. */
function draftOf(view: GuardSettingsView | undefined): SettingsDraft {
  return {
    sessionDays: textValue(view?.sessionDays),
    maxAttempts: textValue(view?.maxAttempts),
    lockMinutes: textValue(view?.lockMinutes),
    listenHost: textValue(view?.listenHost),
    listenPort: textValue(view?.listenPort),
  }
}

/** Copy of `current` with one draft field replaced. */
function withDraftField(current: SettingsDraft, key: keyof SettingsDraft, value: string): SettingsDraft {
  const next: SettingsDraft = { ...current }
  next[key] = value
  return next
}

/** Parse a positive-or-zero integer field; `undefined` when malformed. */
function parseInteger(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === '' || !/^\d+$/u.test(trimmed)) return undefined
  const parsed = Number(trimmed)
  return Number.isSafeInteger(parsed) ? parsed : undefined
}

/** Whether a parsed number sits inside the inclusive contract range. */
function inRange(value: number | undefined, min: number, max: number): value is number {
  return value !== undefined && Number.isFinite(value) && value >= min && value <= max
}

/** Fall back to echoing the key when the host did not inject a translator. */
function makeTranslate(t: Translate | undefined): Translate {
  if (typeof t === 'function') return t
  return (key: string): string => key
}

/** Localized "invalid field" message for client-side validation. */
function invalidField(t: Translate, fieldKey: string): string {
  return t('error.invalid_field', { field: t(fieldKey) })
}

/** Localize one failed API result, including per-field attribution. */
function describeError(t: Translate, failure: GuardFailure): string {
  if (failure.error === 'invalid_field' && failure.field !== undefined) {
    const key = FIELD_KEYS[failure.field]
    return t('error.invalid_field', { field: key === undefined ? failure.field : t(key) })
  }
  const key = ERROR_KEYS[failure.error]
  if (key !== undefined) return t(key)
  return t('error.generic', { error: failure.error })
}

/** Human-readable timestamp; malformed server data renders as a dash. */
function formatDateTime(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return '—'
  }
}

/** Browser string for the sessions table, with a dash for an empty UA. */
function userAgentText(ua: string): string {
  const trimmed = typeof ua === 'string' ? ua.trim() : ''
  return trimmed === '' ? '—' : trimmed
}

/** Auto-dismiss a success notice after a few seconds. */
function useTransientNotice(
  notice: Notice | undefined,
  setNotice: Dispatch<SetStateAction<Notice | undefined>>,
): void {
  useEffect(() => {
    if (notice === undefined || notice.kind !== 'ok') return undefined
    const timer = window.setTimeout(() => {
      setNotice(undefined)
    }, NOTICE_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [notice, setNotice])
}

/** Label + control + hint, matching a harness settings field row. */
function Field(props: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}): ReactElement {
  return (
    <div className="wg-field">
      <label className="wg-label" htmlFor={props.id}>
        {props.label}
      </label>
      {props.children}
      {props.hint === undefined ? null : <span className="wg-hint">{props.hint}</span>}
    </div>
  )
}

/** Inline status line; nothing when there is no message. */
function NoticeLine(props: { notice: Notice | undefined }): ReactElement | null {
  if (props.notice === undefined) return null
  const failed = props.notice.kind === 'error'
  return (
    <p className={failed ? 'wg-notice wg-noticeError' : 'wg-notice wg-noticeOk'} role={failed ? 'alert' : 'status'}>
      {props.notice.text}
    </p>
  )
}

/**
 * Render the Security settings page.
 * @param props - slot owner props plus the bound translator.
 * @returns the page; a failed load renders an inline error with a retry button.
 */
export function GuardSettings({ t }: GuardSettingsProps): ReactElement {
  const translate = makeTranslate(t)
  // Keep the latest translator for async continuations without re-running the
  // initial load effect when the host hands over a fresh (but equivalent)
  // bound function.
  const translateRef = useRef<Translate>(translate)
  translateRef.current = translate

  const [state, setState] = useState<GuardStateResponse | undefined>(undefined)
  const [draft, setDraft] = useState<SettingsDraft>(EMPTY_DRAFT)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<LoadFailure | undefined>(undefined)
  const [reloadTick, setReloadTick] = useState(0)

  const [policyBusy, setPolicyBusy] = useState(false)
  const [policyNotice, setPolicyNotice] = useState<Notice | undefined>(undefined)
  const [listenerBusy, setListenerBusy] = useState(false)
  const [listenerNotice, setListenerNotice] = useState<Notice | undefined>(undefined)
  const [listenerRestart, setListenerRestart] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordNotice, setPasswordNotice] = useState<Notice | undefined>(undefined)

  const [kicking, setKicking] = useState('')
  const [sessionsNotice, setSessionsNotice] = useState<Notice | undefined>(undefined)

  const [signOutBusy, setSignOutBusy] = useState(false)
  const [signOutNotice, setSignOutNotice] = useState<Notice | undefined>(undefined)
  const [signedOut, setSignedOut] = useState(false)

  useTransientNotice(policyNotice, setPolicyNotice)
  useTransientNotice(listenerNotice, setListenerNotice)
  useTransientNotice(passwordNotice, setPasswordNotice)
  useTransientNotice(sessionsNotice, setSessionsNotice)
  useTransientNotice(signOutNotice, setSignOutNotice)

  // Initial load (and every manual refresh): the wrapper never rejects, but a
  // stray rejection is still converted into an inline error so the slot can
  // never go blank.
  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchGuardState()
      .then((result) => {
        if (!alive) return
        if (result.ok) {
          setState(result.data)
          setDraft(draftOf(result.data.settings))
          // The configured listener may already differ from the running binding
          // (for example after a previous save and a page reload).
          setListenerRestart(result.data.restartRequired === true)
          setLoadError(undefined)
        } else {
          setLoadError({
            text: describeError(translateRef.current, result),
            unauthorized: result.error === 'unauthorized',
          })
        }
        setLoading(false)
      })
      .catch((error: unknown) => {
        if (!alive) return
        setLoadError({
          text: translateRef.current('error.generic', { error: String(error) }),
          unauthorized: false,
        })
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [reloadTick])

  /** Reflect settings the server actually stored, keeping unrelated drafts. */
  const acceptSettings = (view: GuardSettingsView): void => {
    setState((current) => (current === undefined ? current : { ...current, settings: view }))
  }

  const onDraft = (key: keyof SettingsDraft) => (event: ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value
    setDraft((current) => withDraftField(current, key, value))
  }

  /** Read the settings endpoint result into local state and a notice. */
  const applySettingsResult = (
    result: GuardResult<UpdateSettingsResponse>,
    onSuccess: (data: UpdateSettingsResponse) => void,
    successText: (data: UpdateSettingsResponse) => string,
    setNotice: Dispatch<SetStateAction<Notice | undefined>>,
  ): void => {
    if (!result.ok) {
      setNotice({ kind: 'error', text: describeError(translateRef.current, result) })
      return
    }
    acceptSettings(result.data.settings)
    onSuccess(result.data)
    setNotice({ kind: 'ok', text: successText(result.data) })
  }

  const savePolicy = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const t0 = translateRef.current
    const sessionDays = parseInteger(draft.sessionDays)
    const maxAttempts = parseInteger(draft.maxAttempts)
    const lockMinutes = parseInteger(draft.lockMinutes)
    if (!inRange(sessionDays, LIMITS.sessionDays.min, LIMITS.sessionDays.max)) {
      setPolicyNotice({ kind: 'error', text: invalidField(t0, 'field.sessionDays') })
      return
    }
    if (!inRange(maxAttempts, LIMITS.maxAttempts.min, LIMITS.maxAttempts.max)) {
      setPolicyNotice({ kind: 'error', text: invalidField(t0, 'field.maxAttempts') })
      return
    }
    if (!inRange(lockMinutes, LIMITS.lockMinutes.min, LIMITS.lockMinutes.max)) {
      setPolicyNotice({ kind: 'error', text: invalidField(t0, 'field.lockMinutes') })
      return
    }
    setPolicyBusy(true)
    setPolicyNotice(undefined)
    try {
      const result = await updateGuardSettings({ sessionDays, maxAttempts, lockMinutes })
      applySettingsResult(
        result,
        (data) => {
          setDraft((current) => ({
            ...current,
            sessionDays: textValue(data.settings.sessionDays),
            maxAttempts: textValue(data.settings.maxAttempts),
            lockMinutes: textValue(data.settings.lockMinutes),
          }))
        },
        () => t0('policy.saved'),
        setPolicyNotice,
      )
    } finally {
      setPolicyBusy(false)
    }
  }

  const saveListener = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const t0 = translateRef.current
    const listenHost = draft.listenHost.trim()
    const listenPort = parseInteger(draft.listenPort)
    if (listenHost === '' || listenHost.length > 64) {
      setListenerNotice({ kind: 'error', text: invalidField(t0, 'field.listenHost') })
      return
    }
    if (!inRange(listenPort, LIMITS.listenPort.min, LIMITS.listenPort.max)) {
      setListenerNotice({ kind: 'error', text: invalidField(t0, 'field.listenPort') })
      return
    }
    setListenerBusy(true)
    setListenerNotice(undefined)
    setListenerRestart(false)
    try {
      const result = await updateGuardSettings({ listenHost, listenPort })
      applySettingsResult(
        result,
        (data) => {
          setDraft((current) => ({
            ...current,
            listenHost: textValue(data.settings.listenHost),
            listenPort: textValue(data.settings.listenPort),
          }))
          setListenerRestart(data.restartRequired === true)
        },
        (data) => (data.restartRequired ? t0('listener.restartRequired') : t0('listener.saved')),
        setListenerNotice,
      )
    } finally {
      setListenerBusy(false)
    }
  }

  const savePassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const t0 = translateRef.current
    if (currentPassword === '') {
      setPasswordNotice({ kind: 'error', text: t0('password.requiredCurrent') })
      return
    }
    if (nextPassword === '') {
      setPasswordNotice({ kind: 'error', text: t0('password.requiredNext') })
      return
    }
    if (nextPassword.length < 6) {
      setPasswordNotice({ kind: 'error', text: t0('error.too_short') })
      return
    }
    if (nextPassword !== confirmPassword) {
      setPasswordNotice({ kind: 'error', text: t0('error.mismatch') })
      return
    }
    setPasswordBusy(true)
    setPasswordNotice(undefined)
    try {
      const result = await changeGuardPassword({
        current: currentPassword,
        next: nextPassword,
        confirm: confirmPassword,
      })
      if (!result.ok) {
        setPasswordNotice({ kind: 'error', text: describeError(t0, result) })
        return
      }
      setCurrentPassword('')
      setNextPassword('')
      setConfirmPassword('')
      setPasswordNotice({ kind: 'ok', text: t0('password.saved') })
    } finally {
      setPasswordBusy(false)
    }
  }

  const refreshSessions = (): void => {
    setSessionsNotice(undefined)
    setReloadTick((value) => value + 1)
  }

  const kickSession = async (id: string): Promise<void> => {
    const t0 = translateRef.current
    setKicking(id)
    setSessionsNotice(undefined)
    try {
      const result = await kickGuardSession({ id })
      if (!result.ok) {
        setSessionsNotice({ kind: 'error', text: describeError(t0, result) })
        return
      }
      setState((current) =>
        current === undefined
          ? current
          : { ...current, sessions: current.sessions.filter((session) => session.id !== id) },
      )
      setSessionsNotice({ kind: 'ok', text: t0('sessions.kicked') })
    } finally {
      setKicking('')
    }
  }

  const signOutEverywhere = async (): Promise<void> => {
    const t0 = translateRef.current
    let confirmed = false
    try {
      confirmed = window.confirm(t0('signout.confirm'))
    } catch {
      confirmed = false
    }
    if (!confirmed) return
    setSignOutBusy(true)
    setSignOutNotice(undefined)
    try {
      const result = await signOutAllDevices()
      if (!result.ok) {
        setSignOutNotice({ kind: 'error', text: describeError(t0, result) })
        return
      }
      setSignedOut(true)
      setState((current) => (current === undefined ? current : { ...current, sessions: [] }))
      setSignOutNotice({ kind: 'ok', text: t0('signout.done') })
    } finally {
      setSignOutBusy(false)
    }
  }

  // Runtime-defensive view of the payload: a malformed server response must
  // not throw during render (that would blank the settings entry).
  const sessions: SessionView[] =
    state !== undefined && Array.isArray(state.sessions)
      ? state.sessions.filter((session) => session !== null && typeof session === 'object')
      : []

  return (
    <div className="wg-root">
      <header className="wg-head">
        <h2 className="wg-title">{translate('settings.title')}</h2>
        <p className="wg-lead">{translate('settings.lead')}</p>
      </header>

      {loadError === undefined ? null : (
        <section className="wg-card">
          <p className="wg-notice wg-noticeError" role="alert">
            {loadError.text}
          </p>
          <div className="wg-actions">
            {loadError.unauthorized ? (
              <a className="wg-btn" href="/login">
                {translate('signout.goLogin')}
              </a>
            ) : null}
            <button
              type="button"
              className="wg-btn"
              onClick={() => {
                setReloadTick((value) => value + 1)
              }}
            >
              {translate('common.retry')}
            </button>
          </div>
        </section>
      )}

      {loading && state === undefined ? (
        <p className="wg-hint" role="status">
          {translate('common.loading')}
        </p>
      ) : null}

      {state === undefined ? null : (
        <>
          <section className="wg-card" aria-labelledby="wg-policy-title">
            <h3 className="wg-cardTitle" id="wg-policy-title">
              {translate('policy.section')}
            </h3>
            <p className="wg-cardHint">{translate('policy.description')}</p>
            <form
              onSubmit={(event) => {
                void savePolicy(event)
              }}
            >
              <div className="wg-grid">
                <Field
                  id="wg-session-days"
                  label={translate('policy.sessionDays')}
                  hint={translate('policy.sessionDaysHint')}
                >
                  <input
                    id="wg-session-days"
                    className="wg-input"
                    type="number"
                    inputMode="numeric"
                    min={LIMITS.sessionDays.min}
                    max={LIMITS.sessionDays.max}
                    step={1}
                    value={draft.sessionDays}
                    disabled={policyBusy}
                    onChange={onDraft('sessionDays')}
                  />
                </Field>
                <Field
                  id="wg-max-attempts"
                  label={translate('policy.maxAttempts')}
                  hint={translate('policy.maxAttemptsHint')}
                >
                  <input
                    id="wg-max-attempts"
                    className="wg-input"
                    type="number"
                    inputMode="numeric"
                    min={LIMITS.maxAttempts.min}
                    max={LIMITS.maxAttempts.max}
                    step={1}
                    value={draft.maxAttempts}
                    disabled={policyBusy}
                    onChange={onDraft('maxAttempts')}
                  />
                </Field>
                <Field
                  id="wg-lock-minutes"
                  label={translate('policy.lockMinutes')}
                  hint={translate('policy.lockMinutesHint')}
                >
                  <input
                    id="wg-lock-minutes"
                    className="wg-input"
                    type="number"
                    inputMode="numeric"
                    min={LIMITS.lockMinutes.min}
                    max={LIMITS.lockMinutes.max}
                    step={1}
                    value={draft.lockMinutes}
                    disabled={policyBusy}
                    onChange={onDraft('lockMinutes')}
                  />
                </Field>
              </div>
              <NoticeLine notice={policyNotice} />
              <div className="wg-actions">
                <button type="submit" className="wg-btn wg-btnPrimary" disabled={policyBusy}>
                  {policyBusy ? translate('common.saving') : translate('policy.save')}
                </button>
              </div>
            </form>
          </section>

          <section className="wg-card" aria-labelledby="wg-password-title">
            <h3 className="wg-cardTitle" id="wg-password-title">
              {translate('password.section')}
            </h3>
            <p className="wg-cardHint">{translate('password.description')}</p>
            <form
              onSubmit={(event) => {
                void savePassword(event)
              }}
            >
              <div className="wg-grid">
                <Field id="wg-password-current" label={translate('password.current')}>
                  <input
                    id="wg-password-current"
                    className="wg-input"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    disabled={passwordBusy}
                    onChange={(event) => {
                      setCurrentPassword(event.target.value)
                    }}
                  />
                </Field>
                <Field id="wg-password-next" label={translate('password.next')}>
                  <input
                    id="wg-password-next"
                    className="wg-input"
                    type="password"
                    autoComplete="new-password"
                    value={nextPassword}
                    disabled={passwordBusy}
                    onChange={(event) => {
                      setNextPassword(event.target.value)
                    }}
                  />
                </Field>
                <Field id="wg-password-confirm" label={translate('password.confirm')}>
                  <input
                    id="wg-password-confirm"
                    className="wg-input"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    disabled={passwordBusy}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value)
                    }}
                  />
                </Field>
              </div>
              <NoticeLine notice={passwordNotice} />
              <div className="wg-actions">
                <button type="submit" className="wg-btn wg-btnPrimary" disabled={passwordBusy}>
                  {passwordBusy ? translate('common.saving') : translate('password.submit')}
                </button>
              </div>
            </form>
          </section>

          <section className="wg-card" aria-labelledby="wg-listener-title">
            <h3 className="wg-cardTitle" id="wg-listener-title">
              {translate('listener.section')}
              {listenerRestart ? <span className="wg-badge">{translate('listener.restartBadge')}</span> : null}
            </h3>
            <p className="wg-cardHint">{translate('listener.description')}</p>
            <form
              onSubmit={(event) => {
                void saveListener(event)
              }}
            >
              <div className="wg-grid wg-gridTwo">
                <Field id="wg-listen-host" label={translate('listener.host')} hint={translate('listener.hostHint')}>
                  <input
                    id="wg-listen-host"
                    className="wg-input"
                    type="text"
                    maxLength={64}
                    spellCheck={false}
                    autoComplete="off"
                    value={draft.listenHost}
                    disabled={listenerBusy}
                    onChange={onDraft('listenHost')}
                  />
                </Field>
                <Field id="wg-listen-port" label={translate('listener.port')} hint={translate('listener.portHint')}>
                  <input
                    id="wg-listen-port"
                    className="wg-input"
                    type="number"
                    inputMode="numeric"
                    min={LIMITS.listenPort.min}
                    max={LIMITS.listenPort.max}
                    step={1}
                    value={draft.listenPort}
                    disabled={listenerBusy}
                    onChange={onDraft('listenPort')}
                  />
                </Field>
              </div>
              <NoticeLine notice={listenerNotice} />
              <div className="wg-actions">
                <button type="submit" className="wg-btn wg-btnPrimary" disabled={listenerBusy}>
                  {listenerBusy ? translate('common.saving') : translate('listener.save')}
                </button>
              </div>
            </form>
          </section>

          <section className="wg-card" aria-labelledby="wg-sessions-title">
            <div className="wg-sectionHead">
              <div>
                <h3 className="wg-cardTitle" id="wg-sessions-title">
                  {translate('sessions.section')}
                </h3>
                <p className="wg-cardHint">{translate('sessions.description')}</p>
              </div>
              <button type="button" className="wg-btn" disabled={loading} onClick={refreshSessions}>
                {translate('sessions.refresh')}
              </button>
            </div>
            {sessions.length === 0 ? (
              <p className="wg-empty">{translate('sessions.empty')}</p>
            ) : (
              <div className="wg-tableWrap">
                <table className="wg-table" aria-label={translate('sessions.section')}>
                  <thead>
                    <tr>
                      <th scope="col">{translate('sessions.ip')}</th>
                      <th scope="col">{translate('sessions.ua')}</th>
                      <th scope="col">{translate('sessions.lastSeen')}</th>
                      <th scope="col" aria-label={translate('sessions.kick')} />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <tr key={session.id}>
                        <td className="wg-cellIp">
                          {typeof session.ip === 'string' && session.ip !== '' ? session.ip : '—'}
                          {session.current === true ? (
                            <span className="wg-badge">{translate('sessions.current')}</span>
                          ) : null}
                        </td>
                        <td className="wg-cellUa" title={userAgentText(session.ua)}>
                          {userAgentText(session.ua)}
                        </td>
                        <td className="wg-cellTime">
                          {formatDateTime(session.lastSeen)}
                          <span className="wg-cellTimeDim">
                            {translate('sessions.signedIn', { time: formatDateTime(session.createdAt) })}
                          </span>
                        </td>
                        <td className="wg-cellAction">
                          {session.current ? (
                            // The current device cannot be "kicked" through the API;
                            // its own action is the ordinary per-device sign-out.
                            <a className="wg-btn" href="/logout">
                              {translate('sessions.signOut')}
                            </a>
                          ) : (
                            <button
                              type="button"
                              className="wg-btn wg-btnDanger"
                              disabled={kicking !== ''}
                              onClick={() => {
                                void kickSession(session.id)
                              }}
                            >
                              {kicking === session.id ? translate('sessions.kicking') : translate('sessions.kick')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <NoticeLine notice={sessionsNotice} />
          </section>

          <section className="wg-card" aria-labelledby="wg-signout-title">
            <h3 className="wg-cardTitle" id="wg-signout-title">
              {translate('signout.section')}
            </h3>
            <p className="wg-cardHint">{translate('signout.description')}</p>
            <NoticeLine notice={signOutNotice} />
            <div className="wg-actions">
              {signedOut ? (
                <a className="wg-btn wg-btnPrimary" href="/login">
                  {translate('signout.goLogin')}
                </a>
              ) : (
                // The heavier action leads (it also drops every other device);
                // the ordinary per-device sign-out follows as the calmer option.
                <button
                  type="button"
                  className="wg-btn wg-btnDanger"
                  disabled={signOutBusy}
                  onClick={() => {
                    void signOutEverywhere()
                  }}
                >
                  {signOutBusy ? translate('common.saving') : translate('signout.action')}
                </button>
              )}
              {signedOut ? null : (
                <a className="wg-btn" href="/logout">
                  {translate('signout.self')}
                </a>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
