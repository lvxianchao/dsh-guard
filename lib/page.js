/** Self-contained login page: no build step, no external assets, CSP-friendly. */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * Render the login document.
 * @param {object} options
 * @param {string} options.title - product label shown on the card
 * @param {string} [options.error] - error line under the form
 * @param {string} [options.next] - same-origin relative path to return to
 * @param {boolean} [options.locked] - render the lockout notice instead of the form
 */
export function loginPage({ title = 'DSH', error = '', next = '/', locked = false } = {}) {
  const nextField = next && next.startsWith('/') && !next.startsWith('//') ? `<input type="hidden" name="next" value="${esc(next)}">` : ''
  const body = locked
    ? `<p class="err">尝试次数过多，请稍后再试。</p>`
    : `<form method="post" action="/login" autocomplete="off">
        ${nextField}
        <label for="password">访问密码</label>
        <input id="password" name="password" type="password" required autofocus
               autocomplete="current-password" placeholder="输入密码">
        ${error ? `<p class="err">${esc(error)}</p>` : ''}
        <button type="submit">进入</button>
      </form>`
  return `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)} · 登录</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d10;color:#e6e8eb;
       font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif}
  .card{width:min(92vw,360px);padding:28px 26px;border:1px solid #24282e;border-radius:14px;background:#12151a;
        box-shadow:0 18px 50px rgba(0,0,0,.45)}
  h1{margin:0 0 4px;font-size:17px;font-weight:600}
  p.sub{margin:0 0 18px;color:#8b929c;font-size:13px}
  label{display:block;font-size:13px;color:#a7aeb8;margin-bottom:6px}
  input{width:100%;padding:11px 12px;border-radius:9px;border:1px solid #2c3138;background:#0e1116;color:#e6e8eb;
        font-size:15px;outline:none}
  input:focus{border-color:#4a7dff;box-shadow:0 0 0 3px rgba(74,125,255,.18)}
  button{width:100%;margin-top:14px;padding:11px;border:0;border-radius:9px;background:#3f6df0;color:#fff;
         font-size:15px;font-weight:600;cursor:pointer}
  button:hover{background:#4a7dff}
  .err{margin:10px 0 0;color:#ff7b72;font-size:13px}
  .foot{margin-top:18px;color:#5f666f;font-size:12px;text-align:center}
</style>
</head><body>
  <main class="card">
    <h1>${esc(title)}</h1>
    <p class="sub">此服务需要密码才能访问</p>
    ${body}
    <p class="foot">DeepSeek Harness · dsh-guard</p>
  </main>
</body></html>`
}

/** Minimal logout confirmation (no JS needed). */
export function logoutPage({ title = 'DSH' } = {}) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · 已退出</title>
<style>:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d10;
color:#e6e8eb;font:15px system-ui,sans-serif}a{color:#4a7dff}</style></head>
<body><main style="text-align:center"><h1 style="font-size:16px">已退出登录</h1>
<p><a href="/login">重新登录</a></p></main></body></html>`
}
