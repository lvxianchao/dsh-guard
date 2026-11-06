/**
 * Palette for the pages this plugin renders itself: the login form and the
 * signed-out page. Those are standalone documents before
 * the harness boots, so they cannot use the harness `--dsw-alias-*` tokens;
 * they carry their own two palettes. The server half forces the harness
 * `ui-theme` preference when it is `light`/`dark`; `system`/unset follows the
 * operating system, and `?theme=light|dark` overrides both (screenshots, kiosks).
 *
 * The native settings page does NOT use this file: it renders inside the
 * harness React tree and inherits the live `--dsw-alias-*` tokens directly.
 * Keep the values close to the measured harness palette (0.2.2-rc.1) so a user
 * who opens the standalone page sees a familiar surface.
 */

export type ThemeName = 'light' | 'dark'

export interface ThemePalette {
  /** Page canvas. */
  bg: string
  /** Card surface above the canvas. */
  card: string
  /** Inset surface: inputs and chips. */
  inset: string
  /** Hairline borders. */
  line: string
  /** Stronger border for focus-adjacent edges. */
  lineStrong: string
  text: string
  muted: string
  accent: string
  accentHover: string
  accentText: string
  danger: string
  dangerSurface: string
  ok: string
  okSurface: string
  hoverSurface: string
}

export const PALETTES: Record<ThemeName, ThemePalette> = {
  light: {
    bg: '#ffffff',
    card: '#ffffff',
    inset: '#f5f6f7',
    line: 'rgba(15, 17, 21, 0.10)',
    lineStrong: 'rgba(15, 17, 21, 0.18)',
    text: '#0f1115',
    muted: '#61666b',
    accent: '#4176e6',
    accentHover: '#2f63d4',
    accentText: '#ffffff',
    danger: '#c2402f',
    dangerSurface: 'rgba(194, 64, 47, 0.08)',
    ok: '#1f7a46',
    okSurface: 'rgba(31, 122, 70, 0.10)',
    hoverSurface: 'rgba(15, 17, 21, 0.05)',
  },
  dark: {
    bg: '#151517',
    card: '#232324',
    inset: '#2c2c2e',
    line: 'rgba(249, 250, 251, 0.10)',
    lineStrong: 'rgba(249, 250, 251, 0.18)',
    text: '#f9fafb',
    muted: '#cfd3d6',
    accent: '#7aaaff',
    accentHover: '#9dbdff',
    accentText: '#0b0d10',
    danger: '#ff8f87',
    dangerSurface: 'rgba(255, 123, 114, 0.12)',
    ok: '#8fdca8',
    okSurface: 'rgba(143, 220, 168, 0.12)',
    hoverSurface: 'rgba(249, 250, 251, 0.07)',
  },
}

/** Custom property name for a palette entry. */
const VARS: ReadonlyArray<readonly [keyof ThemePalette, string]> = [
  ['bg', '--gws-bg'],
  ['card', '--gws-card'],
  ['inset', '--gws-inset'],
  ['line', '--gws-line'],
  ['lineStrong', '--gws-line-strong'],
  ['text', '--gws-text'],
  ['muted', '--gws-muted'],
  ['accent', '--gws-accent'],
  ['accentHover', '--gws-accent-hover'],
  ['accentText', '--gws-accent-text'],
  ['danger', '--gws-danger'],
  ['dangerSurface', '--gws-danger-surface'],
  ['ok', '--gws-ok'],
  ['okSurface', '--gws-ok-surface'],
  ['hoverSurface', '--gws-hover'],
]

/** `--gws-*` declarations for one palette, without a selector. */
export function cssVariables(theme: ThemeName): string {
  const palette = PALETTES[theme]
  const decls = VARS.map(([key, name]) => `${name}:${palette[key]}`).join(';')
  return `color-scheme:${theme};${decls}`
}

/**
 * The page-level theme block: light by default, dark when the system asks for
 * it, and either palette forced by `data-theme` (set from `?theme=`).
 * The forced selectors come last so they win over the media query.
 */
export function themeCss(): string {
  return [
    `:root{${cssVariables('light')}}`,
    `@media (prefers-color-scheme: dark){:root{${cssVariables('dark')}}}`,
    `:root[data-theme="dark"]{${cssVariables('dark')}}`,
    `:root[data-theme="light"]{${cssVariables('light')}}`,
  ].join('\n')
}

/** Parse `?theme=light|dark`; anything else means "follow the system". */
export function themeFromQuery(search: string | null | undefined): ThemeName | undefined {
  if (!search) return undefined
  const value = new URLSearchParams(search.startsWith('?') ? search : `?${search}`).get('theme')
  return value === 'light' || value === 'dark' ? value : undefined
}

/**
 * Head script for the forced-theme case. It runs before first paint so a
 * `?theme=dark` screenshot does not flash light first.
 *
 * Precedence: explicit `?theme=` query, then the harness preference read from
 * the profile patch (`ui-theme`), then nothing — nothing means the document
 * follows `prefers-color-scheme`, which is the system fallback.
 * @param search - request query string.
 * @param harnessPreference - raw `light|dark|system` value from the profile.
 */
export function themeBootScript(search: string | null | undefined, harnessPreference?: string): string {
  const forced = themeFromQuery(search) ?? (harnessPreference === 'light' || harnessPreference === 'dark' ? harnessPreference : undefined)
  if (!forced) return ''
  return `<script>document.documentElement.setAttribute('data-theme',${JSON.stringify(forced)})</script>`
}
