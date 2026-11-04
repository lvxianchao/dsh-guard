/**
 * Index transforms injected into the harness UI.
 *
 * Two additions, both dependency-free and inert until the page loads:
 *  1. the secure-context `crypto.randomUUID` shim (plain-HTTP deployments)
 *  2. a small fixed "dsh-guard" button that opens the admin page
 *
 * Injection is plain DOM at the end of <body>, outside the React root, so a
 * harness re-render cannot remove it and no harness API is involved.
 */
import { injectPolyfill } from './polyfill.js'

const FAB = `<style data-dsh-guard-fab-style>
#dsh-guard-fab{position:fixed;right:16px;bottom:16px;z-index:2147483000;width:34px;height:34px;border-radius:50%;
display:flex;align-items:center;justify-content:center;background:rgba(18,21,26,.72);border:1px solid rgba(255,255,255,.12);
color:#3f6df0;text-decoration:none;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:.42;
transition:opacity .15s,color .15s,transform .15s;box-shadow:0 4px 16px rgba(0,0,0,.35)}
#dsh-guard-fab:hover,#dsh-guard-fab:focus-visible{opacity:.95;color:#6f95ff;transform:translateY(-1px)}
#dsh-guard-fab svg{display:block}
@media (max-width:520px){#dsh-guard-fab{right:12px;bottom:12px;width:32px;height:32px;opacity:.42}}
@media print{#dsh-guard-fab{display:none}}
</style>
<a id="dsh-guard-fab" href="/__guard/admin" title="dsh-guard 设置" aria-label="dsh-guard 设置">
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 0 2 2.5v5c0 3.4 2.4 6.6 6 7.5 3.6-.9 6-4.1 6-7.5v-5L8 0Zm0 1.6 4.8 2v3.9c0 2.7-1.9 5.3-4.8 6.1-2.9-.8-4.8-3.4-4.8-6.1V3.6l4.8-2Z"/></svg>
</a>`

/** Apply every index transform this plugin owns. */
export function injectUi(html) {
  if (typeof html !== 'string') return html
  let out = injectPolyfill(html)
  if (!out.includes('id="dsh-guard-fab"')) {
    const body = out.lastIndexOf('</body>')
    out = body === -1 ? out + FAB : out.slice(0, body) + FAB + out.slice(body)
  }
  return out
}
