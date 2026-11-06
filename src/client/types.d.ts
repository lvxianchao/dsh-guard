/**
 * Local structural types for the DSH browser host.
 *
 * The client bundle runs inside the harness Web UI and the host owns the
 * runtime objects. These declarations mirror only the small surface this
 * plugin uses, so the plugin never imports an `@deepseek-ai/*` runtime value
 * (the published package must keep loading even when an upstream type moves
 * between release candidates). React itself is supplied by the host module
 * table; only React's own package types are referenced here.
 */
import type { ComponentType } from 'react'

/** Translate function bound to the plugin's own locale namespace. */
export type Translate = (key: string, vars?: Record<string, string | number>) => string

/** Removes a registration; returned by every host registry entry point. */
export type Disposer = () => void

/**
 * Options accepted by `ctx.slots.register` for one contribution.
 *
 * `name` selects the slot; list slots additionally key entries by `id` and
 * order them by `order`. `label` is registrant-localized (the shell may call
 * it on every render, so returning `t(...)` is correct and re-localizes on a
 * locale switch). `inject` publishes extra props to the component on top of
 * the slot's owner props.
 */
export interface SlotRegisterOptions {
  name: string
  id?: string
  order?: number
  label?: string | (() => string)
  /** Locale namespace used by the framework-injected `t` seat (when any). */
  locale?: string
  inject?: () => Record<string, unknown>
}

/** The slice of the host slot registry used by this plugin. */
export interface SlotsService {
  /** Register one contribution; returns its disposer. */
  register<P extends object>(options: SlotRegisterOptions, component: ComponentType<P>): Disposer
  /**
   * Install a callback for the lifetime of the declarations that provide the
   * slot. The callback runs when the slot becomes available and its return
   * value is disposed with the plugin fiber.
   */
  inject(key: string, callback: () => void | Disposer): Disposer
}

/** The slice of the host locale registry used by this plugin. */
export interface LocaleService {
  /** Register the plugin dictionaries for every built-in language. */
  register(ns: string, dicts: { zh: Record<string, string>; en: Record<string, string> }): Disposer
  /** Bind a stable translate function for a registered namespace. */
  bind(ns: string): Translate
}

/** The browser-side context object handed to `apply`. */
export interface ClientContext {
  readonly slots: SlotsService
  readonly locale: LocaleService
  /** Run `callback` now and dispose its return value when the plugin unloads. */
  effect(callback: () => void | Disposer, label?: string): Disposer
}

/** Props the settings shell hands to a `settings.section` contribution. */
export interface SettingsSectionProps {
  /** Close the settings panel (the shell owns the open state). */
  close: () => void
}

/** Props the settings navigation hands to a `settings.section.icon` contribution. */
export interface SettingsSectionIconProps {
  /** Requested square edge in pixels. */
  size: number
  /** Whether this section is the selected one. */
  active: boolean
}

/** Factory contract used by the host module loader for one client bundle. */
export interface ModuleFactory {
  (require: (id: string) => unknown): unknown
}

/** Definition passed to `window.__ModuleLoader__.load`. */
export interface ModuleLoaderDefinition {
  id: string
  factory: ModuleFactory
}

/** The browser global the build wrapper calls; absent outside the harness. */
export interface ModuleLoaderHost {
  load(definition: ModuleLoaderDefinition): void
}

declare global {
  interface Window {
    /** Present only in the harness Web UI. */
    __ModuleLoader__?: ModuleLoaderHost
  }
}

/** Exports of `src/client/module.tsx` as the host loader consumes them. */
export interface GuardClientModule {
  /** Services that must exist before `apply` is called. */
  inject: string[]
  /** Install dictionaries, slot contributions, styles, and fallback cleanup. */
  apply(ctx: ClientContext): void
}
