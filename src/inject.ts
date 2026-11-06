/**
 * Index transforms injected into the harness UI.
 *
 * Two additions, both dependency-free and inert until the page loads:
 *  1. the secure-context `crypto.randomUUID` shim (plain-HTTP deployments)
 *  2. a small session watchdog that sends the browser to the login page when
 *     the guard session is gone (revoked, expired, password changed)
 *
 * The management surface itself is NOT injected any more: v3 registers a native
 * `settings.section` page through the client bundle, which is the only entry.
 * Injection is plain DOM at the end of <body>, outside the React root, so a
 * harness re-render cannot remove it and no harness API is involved.
 */
import { injectPolyfill } from './polyfill.js'

const WATCHDOG = `<script data-dsh-web-guard-watchdog>(function(){
  "use strict";

  // DSH only ever sees "WebSocket closed"; it does not know this gate exists.
  // When the session is really gone (password change, sign-out everywhere,
  // expiry) we send the browser to the login page instead of spinning on
  // reconnect. A 401 is the only trigger: a failed fetch means the network is
  // down.
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
})();</script>`

/** Options for the index transform. */
export interface InjectUiOptions {
  /** Omit the secure-context shim; the session watchdog is injected either way. */
  polyfill?: boolean
}

/** Apply every index transform this plugin owns. */
export function injectUi(html: string, options: InjectUiOptions = {}): string {
  if (typeof html !== 'string') return html
  let out = options.polyfill === false ? html : injectPolyfill(html)
  if (!out.includes('data-dsh-web-guard-watchdog')) {
    const body = out.lastIndexOf('</body>')
    out = body === -1 ? out + WATCHDOG : out.slice(0, body) + WATCHDOG + out.slice(body)
  }
  return out
}
