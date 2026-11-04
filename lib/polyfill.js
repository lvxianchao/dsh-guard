/**
 * Secure-context polyfill injected into the served index.
 *
 * Plain-HTTP origins (http://192.168.x.x:3080) are not secure contexts, so
 * `crypto.randomUUID` is undefined there and the UI throws on features that
 * mint ids. The shim below is the same RFC 4122 v4 shape, built on
 * getRandomValues, which IS available in insecure contexts.
 */
const SCRIPT = `<script data-dsh-guard-polyfill>(function(){
  try {
    var c = window.crypto;
    if (!c || typeof c.randomUUID === 'function' || typeof c.getRandomValues !== 'function') return;
    c.randomUUID = function () {
      var b = c.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      var h = '';
      for (var i = 0; i < 16; i++) h += (b[i] + 0x100).toString(16).slice(1);
      return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
    };
  } catch (e) {}
})();</script>`

/**
 * Inject the polyfill once, before any app script runs.
 * @param {string} html - full index document
 * @returns {string} transformed document
 */
export function injectPolyfill(html) {
  if (typeof html !== 'string' || html.includes('data-dsh-guard-polyfill')) return html
  const head = html.indexOf('</head>')
  if (head === -1) return SCRIPT + html
  return html.slice(0, head) + SCRIPT + html.slice(head)
}
