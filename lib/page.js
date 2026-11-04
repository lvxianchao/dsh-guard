/** Self-contained login page: no build step, no external assets, CSP-friendly. */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const GITHUB_ICON = `<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`

/**
 * Render the login document.
 * @param {object} options
 * @param {string} options.title - product label shown above the form
 * @param {string} [options.error] - error line under the form
 * @param {string} [options.next] - same-origin relative path to return to
 * @param {boolean} [options.locked] - render the lockout notice instead of the form
 * @param {string} [options.repo] - repository URL shown under the card
 */
export function loginPage({
  title = 'DeepSeek Harness Guard',
  error = '',
  next = '/',
  locked = false,
  repo = 'https://github.com/lvxianchao/dsh-guard',
} = {}) {
  const nextField = next && next.startsWith('/') && !next.startsWith('//') ? `<input type="hidden" name="next" value="${esc(next)}">` : ''
  const body = locked
    ? `<p class="err locked">尝试次数过多，请稍后再试。</p>`
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
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="dark">
<title>${esc(title)} · 登录</title>
<style>
  :root{color-scheme:dark;--bg:#0b0d10;--card:#12151a;--line:#24282e;--text:#e6e8eb;--muted:#8b929c;--accent:#3f6df0}
  *{box-sizing:border-box}
  html{background:var(--bg)}                     /* paint the canvas, not just the body box */
  html,body{height:100%}
  body{margin:0;min-height:100vh;min-height:100dvh;   /* dvh: no gap under mobile toolbars */
       display:flex;align-items:center;justify-content:center;
       padding:max(20px,env(safe-area-inset-top)) 20px max(20px,env(safe-area-inset-bottom));
       background:var(--bg);color:var(--text);
       font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif;
       -webkit-text-size-adjust:100%}
  .card{width:min(100%,380px);padding:30px 30px 24px;border:1px solid var(--line);border-radius:16px;
        background:var(--card);box-shadow:0 18px 50px rgba(0,0,0,.45)}
  h1{margin:0;font-size:18px;font-weight:600;line-height:1.35;text-align:center}
  p.sub{margin:9px 0 24px;color:var(--muted);font-size:13px;text-align:center}
  label{display:block;font-size:13px;color:#a7aeb8;margin-bottom:6px}
  input{width:100%;padding:11px 12px;border-radius:10px;border:1px solid #2c3138;background:#0e1116;color:var(--text);
        font-size:16px;                          /* 16px stops iOS from zooming on focus */
        line-height:1.3;outline:none;transition:border-color .15s,box-shadow .15s}
  input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(74,125,255,.18)}
  button{width:100%;margin-top:16px;padding:11px;border:0;border-radius:10px;background:var(--accent);color:#fff;
         font-size:15px;font-weight:600;cursor:pointer;transition:background .15s}
  button:hover{background:#4a7dff}
  button:active{background:#3560d8}
  .err{margin:10px 0 0;color:#ff7b72;font-size:13px}
  .err.locked{margin:4px 0 0;text-align:center}
  .foot{margin-top:20px;padding-top:14px;border-top:1px solid #1d2126;text-align:center}
  .repo{display:inline-flex;align-items:center;gap:7px;color:var(--muted);font-size:13px;text-decoration:none;
        padding:5px 10px;border-radius:8px;transition:color .15s,background .15s}
  .repo:hover{color:var(--text);background:#191d22}
  .repo svg{flex:none;opacity:.9}
  @media (max-width:400px){
    .card{padding:24px 20px 20px;border-radius:14px}
    h1{font-size:17px}
    p.sub{margin-bottom:20px}
  }
  @media (max-height:520px){                     /* landscape phones: start from the top */
    body{align-items:flex-start;padding-top:max(16px,env(safe-area-inset-top))}
  }
</style>
</head><body>
  <main class="card">
    <h1>${esc(title)}</h1>
    <p class="sub">此服务需要密码才能访问</p>
    ${body}
    <div class="foot">
      <a class="repo" href="${esc(repo)}" target="_blank" rel="noopener noreferrer">
        ${GITHUB_ICON}<span>dsh-guard</span>
      </a>
    </div>
  </main>
</body></html>`
}

/** Minimal logout confirmation (no JS needed). */
export function logoutPage({ title = 'DeepSeek Harness Guard' } = {}) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(title)} · 已退出</title>
<style>:root{color-scheme:dark}html{background:#0b0d10}body{margin:0;min-height:100vh;min-height:100dvh;
display:flex;align-items:center;justify-content:center;background:#0b0d10;color:#e6e8eb;
font:15px system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
h1{font-size:17px;font-weight:600;margin:0 0 10px}a{color:#4a7dff;text-decoration:none}
p{margin:0;font-size:14px}</style></head>
<body><main style="text-align:center"><h1>已退出登录</h1>
<p><a href="/login">重新登录</a></p></main></body></html>`
}
