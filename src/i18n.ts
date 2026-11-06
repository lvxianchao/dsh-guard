/**
 * Locale detection and copy for the guard's own pages.
 *
 * The harness stores the operator's language choice in the profile patch file
 * (`- id: locale` → `config.preference`), which is exactly what the settings UI
 * writes when someone switches language. Reading it means the login and
 * sign-out pages follow the harness instead of guessing from the browser.
 *
 * When no explicit preference exists, the harness falls back to the browser
 * language — and so do we, via Accept-Language.
 */
import { createPreferenceReader, readPreference } from './preferences.js'

export type Locale = 'zh' | 'en'

const SUPPORTED: readonly string[] = ['zh', 'en']

/**
 * Read the explicit locale preference from a profile patch file.
 * Returns a supported locale id, or '' when unset/unreadable.
 * @param patchPath - profile patch file path.
 */
export function readLocalePreference(patchPath: string): Locale | '' {
  return normalize(readPreference(patchPath, 'locale'))
}

/** Map an arbitrary tag (`zh-CN`, `en-US`) onto a supported id. */
export function normalize(tag: string | null | undefined): Locale | '' {
  const base = String(tag ?? '').toLowerCase().split(/[-_]/)[0]
  return SUPPORTED.includes(base) ? (base as Locale) : ''
}

const EN = {
  locale: 'en',
  // login page
  loginSubtitle: 'This service requires a password',
  passwordLabel: 'Password',
  passwordPh: 'Enter password',
  submit: 'Continue',
  errWrong: 'Incorrect password',
  errLocked: 'Too many attempts — try again later',
  // sign-out page
  loggedOut: 'Signed out',
  signInAgain: 'Sign in again',
  // shared
  errOrigin: 'Request origin rejected',
}

/** Copy bundle for one locale. */
export type Copy = typeof EN

const ZH: Copy = {
  locale: 'zh',
  // login page
  loginSubtitle: '此服务需要密码才能访问',
  passwordLabel: '访问密码',
  passwordPh: '输入密码',
  submit: '进入',
  errWrong: '密码不正确',
  errLocked: '尝试次数过多，请稍后再试',
  // sign-out page
  loggedOut: '已退出登录',
  signInAgain: '重新登录',
  // shared
  errOrigin: '请求来源不合法',
}

const CATALOG: Record<string, Copy> = { zh: ZH, en: EN }

/** Copy bundle for a locale, falling back to English. */
export function t(locale: string): Copy {
  return CATALOG[locale] ?? EN
}

export interface LocaleReader {
  /** Current explicit preference, or '' when the patch file has none. */
  get(): Locale | ''
  dispose(): void
}

/**
 * Keep the patch file's locale preference in memory.
 *
 * The watch/poll mechanics live in `preferences.ts`; this wrapper only maps the
 * raw value onto a supported locale id.
 * @param patchPath - profile patch file path.
 */
export function createLocaleReader(patchPath: string): LocaleReader {
  const reader = createPreferenceReader(patchPath, 'locale')
  return {
    get: () => normalize(reader.get()),
    dispose: () => reader.dispose(),
  }
}
