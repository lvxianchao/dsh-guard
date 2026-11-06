/**
 * Styles for the native settings page.
 *
 * The page renders inside the harness React tree, so every colour comes from
 * the host's `--dsw-alias-*` tokens (with literal fallbacks for an older host).
 * No palette is duplicated here: dark mode is entirely the host's business.
 * Geometry, spacing, and radii are plain values, matching the harness
 * settings rows closely enough that the page looks built in.
 */

/** Selector for the injected stylesheet; also used by the disposer. */
export const GUARD_STYLE_SELECTOR = 'style[data-dsh-web-guard]'

/** Class prefix for every element this page renders. */
export const GUARD_CSS = `
.wg-root{display:flex;flex-direction:column;gap:16px;padding:8px 0 24px;color:var(--dsw-alias-label-primary,#0f1115);font-size:14px;line-height:22px}
.wg-head{display:flex;flex-direction:column;gap:4px}
.wg-title{margin:0;font-size:16px;font-weight:500;line-height:24px}
.wg-lead{margin:0;color:var(--dsw-alias-label-secondary,#61666b);font-size:13px;line-height:20px}
.wg-card{box-sizing:border-box;border:.5px solid var(--dsw-alias-settings-card-stroke,rgba(15,17,21,.12));border-radius:12px;background:var(--dsw-alias-settings-card-fill,transparent);padding:16px}
.wg-cardTitle{margin:0 0 4px;font-size:14px;font-weight:500;line-height:22px}
.wg-cardHint{margin:0 0 12px;color:var(--dsw-alias-label-tertiary,#8b929c);font-size:12px;line-height:18px}
.wg-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.wg-gridTwo{grid-template-columns:repeat(2,minmax(0,1fr))}
.wg-field{display:flex;flex-direction:column;gap:6px;min-width:0;box-sizing:border-box}
.wg-label{color:var(--dsw-alias-label-secondary,#61666b);font-size:12px;line-height:18px}
.wg-hint{color:var(--dsw-alias-label-tertiary,#8b929c);font-size:11px;line-height:16px}
.wg-input{box-sizing:border-box;width:100%;height:34px;padding:0 10px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l2,rgba(15,17,21,.18));background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#0f1115);font:inherit;font-size:14px;line-height:32px}
.wg-input::placeholder{color:var(--dsw-alias-label-quaternary,#a8adb3)}
.wg-input:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:1px}
.wg-sectionHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.wg-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:8px;margin-top:12px}
.wg-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:0 14px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l3,rgba(15,17,21,.22));background:transparent;color:var(--dsw-alias-label-primary,#0f1115);font:inherit;font-size:13px;line-height:20px;cursor:pointer;text-decoration:none;white-space:nowrap}
.wg-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(15,17,21,.06))}
.wg-btn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:1px}
.wg-btn:disabled{opacity:.55;cursor:default}
.wg-btnPrimary{border-color:transparent;background:var(--dsw-alias-button-primary-fill,#4176e6);color:var(--dsw-alias-label-primary-foreground,#fff)}
.wg-btnPrimary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#2f63d4)}
.wg-btnDanger{border-color:transparent;background:transparent;color:var(--dsw-alias-state-error-primary,#c2402f)}
.wg-btnDanger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger,rgba(194,64,47,.08))}
.wg-notice{margin:10px 0 0;font-size:12px;line-height:18px}
.wg-noticeOk{color:var(--dsw-alias-state-success-primary,#1f7a46)}
.wg-noticeError{color:var(--dsw-alias-state-error-primary,#c2402f)}
.wg-badge{display:inline-block;margin-left:6px;padding:0 6px;border:.5px solid var(--dsw-alias-border-l3,rgba(15,17,21,.22));border-radius:999px;color:var(--dsw-alias-label-tertiary,#8b929c);font-size:11px;line-height:16px;white-space:nowrap}
.wg-tableWrap{overflow-x:auto;border:.5px solid var(--dsw-alias-border-l2,rgba(15,17,21,.12));border-radius:10px}
.wg-table{width:100%;min-width:520px;border-collapse:collapse;font-size:13px;line-height:20px}
.wg-table th{text-align:left;padding:8px 12px;color:var(--dsw-alias-label-tertiary,#8b929c);font-weight:400;font-size:12px;border-bottom:.5px solid var(--dsw-alias-border-l2,rgba(15,17,21,.12));white-space:nowrap}
.wg-table td{padding:9px 12px;vertical-align:middle;border-bottom:.5px solid var(--dsw-alias-border-l2,rgba(15,17,21,.12))}
.wg-table tr:last-child td{border-bottom:none}
.wg-cellIp{white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.wg-cellUa{max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#61666b)}
.wg-cellTime{white-space:nowrap;color:var(--dsw-alias-label-secondary,#61666b);font-size:12px}
.wg-cellTimeDim{display:block;color:var(--dsw-alias-label-tertiary,#8b929c);font-size:11px;line-height:16px}
.wg-cellAction{text-align:right;white-space:nowrap}
.wg-empty{padding:16px 12px;color:var(--dsw-alias-label-tertiary,#8b929c);text-align:center}
.wg-inlineActions{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-top:12px}
.wg-link{color:var(--dsw-alias-link,#4176e6);text-decoration:none}
.wg-link:hover{text-decoration:underline}
@media (max-width:640px){
  .wg-root{gap:12px;padding-bottom:16px}
  .wg-grid,.wg-gridTwo{grid-template-columns:minmax(0,1fr)}
  .wg-card{padding:12px}
  .wg-actions{flex-direction:column;align-items:stretch}
  .wg-actions .wg-btn{width:100%}
  .wg-inlineActions{flex-direction:column;align-items:stretch}
}
`

/**
 * Insert the page stylesheet and return its disposer.
 *
 * Every activation owns its own tag (no cross-instance dedupe) so unloading
 * one client-module instance can never strip the styles of a live one during
 * HMR; the duplicated CSS of an overlapping pair is identical and harmless.
 * @returns removes the stylesheet this call installed.
 */
export function installGuardStyles(): () => void {
  if (typeof document === 'undefined' || document.head === null) return () => {}
  const tag = document.createElement('style')
  tag.setAttribute('data-dsh-web-guard', '')
  tag.textContent = GUARD_CSS
  document.head.appendChild(tag)
  return () => tag.remove()
}
