/**
 * The slice of the Cordis Host context this plugin consumes.
 *
 * These interfaces are deliberately local and structural instead of imported
 * from @deepseek-ai/dsh-*: the runtime is the authority, the packages are
 * release candidates, and a published plugin must not fail to build because an
 * upstream type moved. Every member below is used by the plugin and is
 * exercised by the shadow-instance check.
 */
export interface WebServerService {
  /** Origin of the loopback harness listener, e.g. `http://127.0.0.1:3080`. */
  getOrigin(): string
  /** Raw index transform hook; the returned disposer removes the transform. */
  tapIndex(transform: (html: string) => string): () => void
  /** The harness listener binding, used for the "bind it to loopback" warning. */
  readonly config?: { readonly host?: string }
}

export interface ConnectionService {
  /** Wrap a URL with the launch token the harness issued to this process. */
  authenticatedUrl(url: string): string
}

export interface ProfileContext {
  /** Absolute path of the profile patch file the process was started with. */
  readonly patchPath: string
}

export interface HostContext {
  readonly webServer: WebServerService
  readonly connection: ConnectionService
  /** Present only in a profile launched by `dsh`. */
  readonly profileContext?: ProfileContext
  /** Profile-boot escape hatch some hosts expose for `profileContext`. */
  get?(name: string): unknown
  /** Run `callback` now and dispose its return value when this plugin unloads. */
  effect(callback: () => void | (() => void), label?: string): () => void
}
