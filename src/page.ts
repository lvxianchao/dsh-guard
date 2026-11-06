/** Self-contained login/logout pages: no build step, no external assets. Localised. */
import { t } from './i18n.js'
import type { Locale } from './i18n.js'
import { themeBootScript, themeCss } from './shared/theme.js'

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c])

const GITHUB_ICON = `<svg viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`
const SHIELD_ICON = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0 2 2.5v5c0 3.4 2.4 6.6 6 7.5 3.6-.9 6-4.1 6-7.5v-5L8 0Zm0 1.6 4.8 2v3.9c0 2.7-1.9 5.3-4.8 6.1-2.9-.8-4.8-3.4-4.8-6.1V3.6l4.8-2Z"/></svg>`

export interface LoginPageOptions {
  /** Product label shown above the form. */
  title?: string
  /** Error line under the form. */
  error?: string
  /** Same-origin relative path to return to. */
  next?: string
  /** Render the lockout notice instead of the form. */
  locked?: boolean
  /** Repository URL shown under the card. */
  repo?: string
  locale?: Locale
  /** Query string used for the `?theme=` override. */
  search?: string
}

/** Render the login document (light/dark palette from shared/theme). */
export function loginPage({
  title = 'DSH Web Guard',
  error = '',
  next = '/',
  locked = false,
  repo = 'https://github.com/lvxianchao/dsh-web-guard',
  locale = 'zh',
  search = '',
}: LoginPageOptions = {}): string {
  const L = t(locale)
  const nextField = next && next.startsWith('/') && !next.startsWith('//') ? `<input type="hidden" name="next" value="${esc(next)}">` : ''
  const body = locked
    ? `<p class="err locked">${esc(L.errLocked)}</p>`
    : `<form method="post" action="/login" autocomplete="off">
        ${nextField}
        <label for="password">${esc(L.passwordLabel)}</label>
        <input id="password" name="password" type="password" required autofocus
               autocomplete="current-password" placeholder="${esc(L.passwordPh)}">
        ${error ? `<p class="err">${esc(error)}</p>` : ''}
        <button type="submit">${esc(L.submit)}</button>
      </form>`
  return `<!doctype html>
<html lang="${locale === 'zh' ? 'zh-CN' : 'en'}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="light dark">
${themeBootScript(search)}
<title>${esc(title)} · ${locale === 'zh' ? '登录' : 'Sign in'}</title>
<style>
${themeCss()}
  *{box-sizing:border-box}
  html{background:var(--gws-bg)}                 /* paint the canvas, not just the body box */
  html,body{height:100%}
  body{margin:0;min-height:100vh;min-height:100dvh;   /* dvh: no gap under mobile toolbars */
       display:flex;align-items:center;justify-content:center;
       padding:max(20px,env(safe-area-inset-top)) 20px max(20px,env(safe-area-inset-bottom));
       background:var(--gws-bg);color:var(--gws-text);
       font:15px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif;
       -webkit-text-size-adjust:100%}
  .card{width:min(100%,380px);padding:30px 30px 24px;border:1px solid var(--gws-line);border-radius:16px;
        background:var(--gws-card);box-shadow:0 18px 50px rgba(0,0,0,.22)}
  .mark{width:48px;height:48px;margin:0 auto 14px;color:var(--gws-accent);opacity:.92}
  .mark svg{display:block;width:100%;height:100%}
  h1{margin:0;font-size:18px;font-weight:600;line-height:1.35;text-align:center}
  p.sub{margin:9px 0 24px;color:var(--gws-muted);font-size:13px;text-align:center}
  label{display:block;font-size:13px;color:var(--gws-muted);margin-bottom:6px}
  input{width:100%;padding:11px 12px;border-radius:10px;border:1px solid var(--gws-line-strong);
        background:var(--gws-inset);color:var(--gws-text);
        font-size:16px;                          /* 16px stops iOS from zooming on focus */
        line-height:1.3;outline:none;transition:border-color .15s,box-shadow .15s}
  input::placeholder{color:var(--gws-muted);opacity:.8}
  input:focus{border-color:var(--gws-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--gws-accent) 22%,transparent)}
  button{width:100%;margin-top:16px;padding:11px;border:0;border-radius:10px;background:var(--gws-accent);
         color:var(--gws-accent-text);font-size:15px;font-weight:600;cursor:pointer;transition:background .15s}
  button:hover{background:var(--gws-accent-hover)}
  button:active{filter:brightness(.94)}
  .err{margin:10px 0 0;color:var(--gws-danger);font-size:13px}
  .err.locked{margin:4px 0 0;text-align:center}
  .foot{margin-top:20px;padding-top:14px;border-top:1px solid var(--gws-line);text-align:center}
  .repo{display:inline-flex;align-items:center;gap:7px;color:var(--gws-muted);font-size:13px;text-decoration:none;
        padding:5px 10px;border-radius:8px;transition:color .15s,background .15s}
  .repo:hover{color:var(--gws-text);background:var(--gws-hover)}
  .repo svg{flex:none;opacity:.9}
  @media (max-width:400px){
    .card{padding:24px 20px 20px;border-radius:14px}
    .mark{width:42px;height:42px;margin-bottom:12px}
    h1{font-size:17px}
    p.sub{margin-bottom:20px}
  }
  @media (max-height:520px){                     /* landscape phones: start from the top */
    body{align-items:flex-start;padding-top:max(16px,env(safe-area-inset-top))}
  }
</style>
</head><body>
  <main class="card">
    <div class="mark">${SHIELD_ICON}</div>
    <h1>${esc(title)}</h1>
    <p class="sub">${esc(L.loginSubtitle)}</p>
    ${body}
    <div class="foot">
      <a class="repo" href="${esc(repo)}" target="_blank" rel="noopener noreferrer">
        ${GITHUB_ICON}<span>DSH Web Guard</span>
      </a>
    </div>
  </main>
</body></html>`
}

export interface LogoutPageOptions {
  title?: string
  locale?: Locale
  /** Query string used for the `?theme=` override. */
  search?: string
}

/** Minimal logout confirmation (no JS needed). */
export function logoutPage({ title = 'DSH Web Guard', locale = 'zh', search = '' }: LogoutPageOptions = {}): string {
  const L = t(locale)
  return `<!doctype html><html lang="${locale === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
${themeBootScript(search)}
<title>${esc(title)} · ${esc(L.loggedOut)}</title>
<style>${themeCss()}
*{box-sizing:border-box}html{background:var(--gws-bg);height:100%}
body{margin:0;height:100%;min-height:100dvh;background:var(--gws-bg);color:var(--gws-text);
display:flex;align-items:center;justify-content:center;
font:15px system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
padding:max(20px,env(safe-area-inset-top)) 20px max(20px,env(safe-area-inset-bottom))}
.mark{width:92px;height:92px;margin:0 auto 22px;color:var(--gws-accent);opacity:.92}
.mark svg{display:block;width:100%;height:100%}
h1{font-size:17px;font-weight:600;margin:0 0 10px}a{color:var(--gws-accent);text-decoration:none}
p{margin:0;font-size:14px}</style></head>
<body><main style="text-align:center"><div class="mark">${SHIELD_ICON}</div><h1>${esc(L.loggedOut)}</h1>
<p><a href="/login">${esc(L.signInAgain)}</a></p></main></body></html>`
}
