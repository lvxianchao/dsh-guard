/**
 * Index transforms injected into the harness UI.
 *
 * Two additions, both dependency-free and inert until the page loads:
 *  1. the secure-context `crypto.randomUUID` shim (plain-HTTP deployments)
 *  2. a small fixed "dsh-web-guard" button that opens the admin page
 *
 * Injection is plain DOM at the end of <body>, outside the React root, so a
 * harness re-render cannot remove it and no harness API is involved.
 */
import { injectPolyfill } from './polyfill.js'

const FAB = `<style data-dsh-web-guard-fab-style>
#dsh-web-guard-fab{position:fixed;right:16px;bottom:16px;z-index:2147483000;width:34px;height:34px;border-radius:50%;
display:flex;align-items:center;justify-content:center;background:rgba(18,21,26,.72);border:1px solid rgba(255,255,255,.12);
color:#3f6df0;text-decoration:none;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:.42;
transition:opacity .15s,color .15s,transform .15s;box-shadow:0 4px 16px rgba(0,0,0,.35)}
#dsh-web-guard-fab:hover,#dsh-web-guard-fab:focus-visible{opacity:.95;color:#6f95ff;transform:translateY(-1px)}
#dsh-web-guard-fab svg{display:block}
#dsh-web-guard-overlay{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.62);
-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px}
#dsh-web-guard-overlay .gwp{position:relative;width:min(780px,94vw);height:86vh;border-radius:16px;overflow:hidden;
border:1px solid #24282e;background:#0b0d10;box-shadow:0 24px 80px rgba(0,0,0,.6)}
#dsh-web-guard-overlay iframe{width:100%;height:100%;border:0;display:block;background:#0b0d10}
@media (max-width:520px){#dsh-web-guard-fab{right:12px;bottom:12px;width:32px;height:32px;opacity:.42}
#dsh-web-guard-overlay{padding:0}
#dsh-web-guard-overlay .gwp{width:100vw;height:100vh;border-radius:0;border:0}}
@media print{#dsh-web-guard-fab{display:none}}
</style>
<a id="dsh-web-guard-fab" href="/__guard/admin" title="dsh-web-guard 设置" aria-label="dsh-web-guard 设置">
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M8 0 2 2.5v5c0 3.4 2.4 6.6 6 7.5 3.6-.9 6-4.1 6-7.5v-5L8 0Zm0 1.6 4.8 2v3.9c0 2.7-1.9 5.3-4.8 6.1-2.9-.8-4.8-3.4-4.8-6.1V3.6l4.8-2Z"/></svg>
</a>
<script data-dsh-web-guard-overlay>(function(){
  "use strict";
  var fab = document.getElementById("dsh-web-guard-fab");
  if (!fab) return;
  var overlay = null;
  function close() {
    if (!overlay) return;
    overlay.remove(); overlay = null;
    document.body.style.overflow = "";
  }
  function open(e) {
    // ⌘/Ctrl/Shift-click or middle-click keeps the native "open in new tab"
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1)) return;
    if (e) e.preventDefault();
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.id = "dsh-web-guard-overlay";
    var panel = document.createElement("div");
    panel.className = "gwp";
    var frame = document.createElement("iframe");
    frame.src = "/__guard/admin";
    frame.title = fab.getAttribute("title") || "dsh-web-guard";
    panel.appendChild(frame);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
  }
  fab.addEventListener("click", open);

  // ── session watchdog ────────────────────────────────────────────────
  // DSH only ever sees "WebSocket closed"; it does not know this gate exists.
  // When the session is really gone (password change, revoke-all, expiry) we
  // send the browser to the login page instead of spinning on reconnect.
  // A 401 is the only trigger: a failed fetch means the network is down.
  var probing = false;
  function probe() {
    if (probing) return;
    probing = true;
    fetch("/__guard/session", { cache: "no-store", credentials: "same-origin" })
      .then(function (r) {
        if (r.status === 401) {
          location.href = "/login?next=" + encodeURIComponent(location.pathname + location.search);
        }
      })
      .catch(function () {})
      .then(function () { probing = false; });
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) probe(); });
  window.addEventListener("online", probe);
  setInterval(probe, 30000);
  var NativeWS = window.WebSocket;
  if (NativeWS) {
    window.WebSocket = function (url, protocols) {
      var ws = protocols === undefined ? new NativeWS(url) : new NativeWS(url, protocols);
      ws.addEventListener("close", function () { setTimeout(probe, 2000); });
      return ws;
    };
    window.WebSocket.prototype = NativeWS.prototype;
    ["CONNECTING", "OPEN", "CLOSING", "CLOSED"].forEach(function (k) {
      window.WebSocket[k] = NativeWS[k];
    });
  }
  window.addEventListener("message", function (ev) {
    if (ev.origin !== location.origin) return;
    if (ev.data === "dsh-web-guard:close") close();
  });
})();</script>`


/** Apply every index transform this plugin owns. */
export function injectUi(html) {
  if (typeof html !== 'string') return html
  let out = injectPolyfill(html)
  if (!out.includes('id="dsh-web-guard-fab"')) {
    const body = out.lastIndexOf('</body>')
    out = body === -1 ? out + FAB : out.slice(0, body) + FAB + out.slice(body)
  }
  return out
}
