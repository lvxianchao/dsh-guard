/**
 * Admin page for dsh-guard: a server-rendered settings form.
 *
 * Why server-rendered instead of a harness client module: the plugin stays
 * build-free and version-independent. The page is one HTML string plus normal
 * form posts, so `dsh plugin add` gives operators a working UI without pulling
 * in a bundler or depending on the harness slot API (which is still moving).
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const GITHUB_ICON = `<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`

const fmtTime = (ms) => {
  if (!ms) return '—'
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const ago = (ms) => {
  if (!ms) return '—'
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (s < 60) return `${s} 秒前`
  if (s < 3600) return `${Math.round(s / 60)} 分钟前`
  if (s < 86400) return `${Math.round(s / 3600)} 小时前`
  return `${Math.round(s / 86400)} 天前`
}

/**
 * Render the admin document.
 * @param {object} options
 * @param {object} options.settings - effective settings shown in the form
 * @param {Array<{ip:string,ua:string,createdAt:number,lastSeen:number,current:boolean}>} options.sessions
 * @param {string} [options.notice] - success line
 * @param {string} [options.error] - error line
 * @param {string} [options.restartNote] - shown when a listened-on value changed
 */
export function adminPage({ settings, sessions = [], notice = '', error = '', restartNote = '' } = {}) {
  const s = settings ?? {}
  const rows = sessions.length === 0
    ? `<tr><td colspan="4" class="empty">当前没有其他活跃会话</td></tr>`
    : sessions.map((x) => `<tr>
        <td>${esc(x.ip)}${x.current ? ' <span class="tag">当前</span>' : ''}</td>
        <td class="ua" title="${esc(x.ua)}">${esc(x.ua || '—')}</td>
        <td>${fmtTime(x.lastSeen)}<span class="dim"> · ${ago(x.lastSeen)}</span></td>
        <td class="num">${x.current ? '' : `<button class="link danger" form="kill" name="id" value="${esc(x.id)}">踢出</button>`}</td>
      </tr>`).join('')

  return `<!doctype html>
<html lang="zh-CN"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="dark">
<title>dsh-guard 设置</title>
<style>
  :root{color-scheme:dark;--bg:#0b0d10;--card:#12151a;--line:#24282e;--text:#e6e8eb;--muted:#8b929c;--accent:#3f6df0;--danger:#ff7b72}
  *{box-sizing:border-box}
  html{background:var(--bg)}
  body{margin:0;min-height:100vh;min-height:100dvh;background:var(--bg);color:var(--text);
       font:15px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;
       -webkit-text-size-adjust:100%;padding:28px 18px max(28px,env(safe-area-inset-bottom))}
  .wrap{width:min(100%,720px);margin:0 auto}
  header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px;flex-wrap:wrap}
  h1{margin:0;font-size:18px;font-weight:600}
  header .links{display:flex;gap:8px;align-items:center;font-size:13px}
  header a{color:var(--muted);text-decoration:none;padding:6px 10px;border-radius:8px}
  header a:hover{color:var(--text);background:#191d22}
  .card{border:1px solid var(--line);border-radius:14px;background:var(--card);padding:20px 22px;margin-bottom:16px}
  .card h2{margin:0 0 4px;font-size:14px;font-weight:600}
  .card p.hint{margin:0 0 16px;color:var(--muted);font-size:12.5px}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
  .field{display:flex;flex-direction:column;gap:5px;min-width:0}
  .field.full{grid-column:1 / -1}
  label{font-size:13px;color:#a7aeb8}
  input{width:100%;padding:10px 11px;border-radius:9px;border:1px solid #2c3138;background:#0e1116;color:var(--text);
        font-size:16px;line-height:1.3;outline:none;transition:border-color .15s,box-shadow .15s}
  input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(74,125,255,.18)}
  input:disabled{opacity:.55;cursor:not-allowed}
  .note{color:#5f666f;font-size:12px}
  .actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:4px}
  button{padding:10px 18px;border:0;border-radius:9px;background:var(--accent);color:#fff;font-size:14px;font-weight:600;cursor:pointer}
  button:hover{background:#4a7dff}
  button.ghost{background:#191d22;color:var(--text);border:1px solid var(--line)}
  button.ghost:hover{background:#20252c}
  button.danger{background:#3a1c1c;color:#ffb4ae;border:1px solid #5a2a2a}
  button.danger:hover{background:#4a2222}
  button.link{background:none;border:0;color:var(--accent);font-size:13px;padding:2px 4px;cursor:pointer}
  button.link.danger{color:var(--danger)}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{text-align:left;padding:9px 8px;border-bottom:1px solid #1d2126;vertical-align:top}
  th{color:var(--muted);font-weight:500;font-size:12px}
  tr:last-child td{border-bottom:0}
  td.ua{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a7aeb8}
  td.num{text-align:right;white-space:nowrap}
  td.empty{text-align:center;color:var(--muted);padding:18px}
  .tag{display:inline-block;font-size:11px;padding:1px 6px;border-radius:999px;background:#1d2f52;color:#9db8ff;vertical-align:1px}
  .dim{color:#5f666f}
  .banner{margin:0 0 16px;padding:10px 14px;border-radius:10px;font-size:13px}
  .banner.ok{background:#12271a;color:#8fdca8;border:1px solid #1e4030}
  .banner.bad{background:#2a1616;color:#ffb4ae;border:1px solid #4a2222}
  .banner.warn{background:#2a2312;color:#e8cf94;border:1px solid #4a3d1e}
  footer{margin:22px 0 0;display:flex;justify-content:center}
  footer a{display:inline-flex;align-items:center;gap:7px;color:var(--muted);font-size:13px;text-decoration:none;
           padding:5px 10px;border-radius:8px}
  footer a:hover{color:var(--text);background:#191d22}
  @media (max-width:560px){
    .grid{grid-template-columns:1fr}
    .card{padding:18px 16px}
    td.ua{max-width:120px}
  }
</style>
</head><body>
<div class="wrap">
  <header>
    <h1>dsh-guard 设置</h1>
    <div class="links">
      <a href="/">返回 DSH</a>
      <a href="/logout">退出登录</a>
    </div>
  </header>

  ${notice ? `<p class="banner ok">${esc(notice)}</p>` : ''}
  ${error ? `<p class="banner bad">${esc(error)}</p>` : ''}
  ${restartNote ? `<p class="banner warn">${esc(restartNote)}</p>` : ''}

  <form method="post" action="/__guard/admin" autocomplete="off">
    <section class="card">
      <h2>登录密码</h2>
      <p class="hint">留空则不修改。修改后其他设备上的会话仍然有效，需要的话用下面的「退出所有设备」。</p>
      <div class="grid">
        <div class="field full"><label for="current">当前密码</label>
          <input id="current" name="current" type="password" autocomplete="current-password" placeholder="修改密码时必填"></div>
        <div class="field"><label for="next">新密码</label>
          <input id="next" name="next" type="password" autocomplete="new-password" placeholder="至少 8 位"></div>
        <div class="field"><label for="confirm">确认新密码</label>
          <input id="confirm" name="confirm" type="password" autocomplete="new-password" placeholder="再输一次"></div>
      </div>
    </section>

    <section class="card">
      <h2>会话与安全</h2>
      <p class="hint">会话有效期从最后一次活动开始计算；改为 0 表示关掉浏览器即失效。</p>
      <div class="grid">
        <div class="field"><label for="sessionDays">会话有效期（天）</label>
          <input id="sessionDays" name="sessionDays" type="number" min="0" max="365" step="1" value="${esc(s.sessionDays)}"></div>
        <div class="field"><label for="lockMinutes">锁定时间（分钟）</label>
          <input id="lockMinutes" name="lockMinutes" type="number" min="1" max="1440" step="1" value="${esc(s.lockMinutes)}"></div>
        <div class="field"><label for="maxAttempts">连续失败次数上限</label>
          <input id="maxAttempts" name="maxAttempts" type="number" min="1" max="50" step="1" value="${esc(s.maxAttempts)}"></div>
      </div>
    </section>

    <section class="card">
      <h2>监听</h2>
      <p class="hint">修改后需要重启 DSH 才生效；填错会导致管理页和外网入口都连不上，确认前先记下原值。</p>
      <div class="grid">
        <div class="field"><label for="listenHost">监听地址</label>
          <input id="listenHost" name="listenHost" type="text" value="${esc(s.listenHost)}"></div>
        <div class="field"><label for="listenPort">监听端口</label>
          <input id="listenPort" name="listenPort" type="number" min="1" max="65535" value="${esc(s.listenPort)}"></div>
      </div>
    </section>

    <div class="actions">
      <button type="submit">保存</button>
      <button type="submit" formaction="/__guard/logout-all" formmethod="post" class="ghost"
              onclick="return confirm('将退出所有设备上的登录，包括当前这个。继续？')">退出所有设备</button>
    </div>
  </form>

  <section class="card" style="margin-top:16px">
    <h2>活跃会话</h2>
    <p class="hint">每个浏览器一条记录。会话存在内存里，重启 DSH 会全部失效。</p>
    <table>
      <thead><tr><th>来源</th><th>浏览器</th><th>最后活动</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>

  <form id="kill" method="post" action="/__guard/kill"></form>

  <footer>
    <a href="${esc(s.repo || 'https://github.com/lvxianchao/dsh-guard')}" target="_blank" rel="noopener noreferrer">
      ${GITHUB_ICON}<span>dsh-guard</span>
    </a>
  </footer>
</div>
</body></html>`
}
