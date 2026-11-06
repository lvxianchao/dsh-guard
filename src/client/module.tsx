/**
 * Browser half of dsh-web-guard: registers the native "Security" settings page
 * and its navigation icon, publishes the `webGuard` dictionaries, installs the
 * page stylesheet, and removes the pre-v3 floating shield once the native page
 * is live.
 *
 * The build (`scripts/build.mjs`) wraps the compiled CJS body in
 * `window.__ModuleLoader__.load({ id, factory })`; this file therefore only
 * exports the loader contract (`inject` + `apply`) and must stay side-effect
 * free at module scope. React arrives from the host module table through the
 * factory's `require`, so only `react` and `react/jsx-runtime` are external.
 */
import type { ReactElement } from 'react'
import { GuardSettings } from './GuardSettings'
import { en, zh } from './locales'
import { installGuardStyles, removeFallbackEntry } from './styles'
import type { ClientContext, SettingsSectionIconProps } from './types'

/** Dictionary namespace owned by this plugin. */
const LOCALE_NS = 'webGuard'

/** Settings section id; shared by the page and its navigation icon. */
const SECTION_ID = 'web-guard'

/** Navigation position: after the built-in sections, before later plugins. */
const SECTION_ORDER = 500

/**
 * Shield glyph for the settings navigation.
 *
 * The shell sizes the icon and tells it whether it is selected; the glyph
 * inherits the row colour so it follows the host theme in both light and dark
 * mode without a palette of its own.
 * @param props - icon owner props from the settings navigation.
 * @returns the SVG element.
 */
function GuardSectionIcon({ size, active }: SettingsSectionIconProps): ReactElement {
  const edge = typeof size === 'number' && Number.isFinite(size) && size > 0 ? Math.min(Math.max(size, 12), 32) : 18
  const selected = active === true
  return (
    <svg
      width={edge}
      height={edge}
      viewBox="0 0 24 24"
      role="presentation"
      focusable="false"
      aria-hidden="true"
      style={{ display: 'block', opacity: selected ? 1 : 0.78 }}
    >
      <path
        d="M12 2.8 4.6 5.9v5.3c0 4.6 3.1 8.3 7.4 9.9 4.3-1.6 7.4-5.3 7.4-9.9V5.9L12 2.8Z"
        fill={selected ? 'currentColor' : 'none'}
        fillOpacity={selected ? 0.12 : 0}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="m8.9 11.7 2.2 2.2 4-4.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Services that must exist before the module can register anything. The host
 * calls `apply` only after both are available.
 */
export const inject: string[] = ['slots', 'locale']

/**
 * Client plugin body: dictionaries, settings section, icon, styles, and
 * fallback-entry cleanup. Everything runs inside `ctx.effect` so unloading the
 * plugin removes every contribution; a host that cannot activate the bundle
 * never sees a half-registered page.
 * @param ctx - browser client context carrying the slot and locale services.
 */
export function apply(ctx: ClientContext): void {
  try {
    const t = ctx.locale.bind(LOCALE_NS)

    ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'web-guard: dictionaries')

    ctx.effect(
      () =>
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: SECTION_ID,
              order: SECTION_ORDER,
              label: () => t('settings.navLabel'),
              locale: LOCALE_NS,
              inject: () => ({ t }),
            },
            GuardSettings,
          ),
        ),
      'web-guard: settings section',
    )

    ctx.effect(
      () =>
        ctx.slots.inject('settings.section.icon', () =>
          ctx.slots.register(
            {
              name: 'settings.section.icon',
              id: SECTION_ID,
              order: SECTION_ORDER,
              label: () => t('settings.navLabel'),
              locale: LOCALE_NS,
            },
            GuardSectionIcon,
          ),
        ),
      'web-guard: settings icon',
    )

    // Styles and the fallback-entry removal are one activation step: the FAB
    // only disappears once the native page exists.
    ctx.effect(() => {
      removeFallbackEntry()
      return installGuardStyles()
    }, 'web-guard: styles and fallback cleanup')
  } catch (error) {
    // A failed activation must leave the host page usable: the server-injected
    // fallback entry still points at the standalone admin page.
    console.warn('[dsh-web-guard] client module failed to activate:', error)
  }
}
