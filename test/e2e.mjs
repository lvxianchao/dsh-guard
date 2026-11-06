/**
 * End-to-end check against a running gate.
 *
 *   GUARD_URL=http://127.0.0.1:3081 GUARD_PASSWORD=... node test/e2e.mjs
 *
 * Asserts the documented behaviour only. It deliberately submits one wrong
 * password, so it consumes one of `maxAttempts` before the temporary lock —
 * run it against a test instance if the limit is set very low. It also writes
 * the profile state file (settings round-trip), so never point it at a
 * production profile.
 */
const BASE = (process.env.GUARD_URL ?? 'http://127.0.0.1:3081').replace(/\/$/, '')
const PASSWORD = process.env.GUARD_PASSWORD ?? ''
const ORIGIN = new URL(BASE).origin

if (!PASSWORD) {
  console.error('GUARD_PASSWORD is required')
  process.exit(2)
}

const main = { cookie: '' }
let failed = 0
let passed = 0

const ok = (name, extra = '') => {
  passed++
  console.log(`  \x1b[32mPASS\x1b[0m ${name}${extra ? ` — ${extra}` : ''}`)
}
const bad = (name, detail) => {
  failed++
  console.log(`  \x1b[31mFAIL\x1b[0m ${name} — ${detail}`)
}
const check = (name, condition, detail) => (condition ? ok(name, detail) : bad(name, detail))
const checkEqual = (name, actual, expected) => check(name, JSON.stringify(actual) === JSON.stringify(expected), `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`)
const formBody = (password, next) => `password=${encodeURIComponent(password)}${next ? `&next=${encodeURIComponent(next)}` : ''}`

/** Minimal client: fetch does not keep cookies for us. */
async function request(path, { method = 'GET', body, headers = {}, auth = true, jar = main } = {}) {
  const h = { ...headers }
  if (auth && jar.cookie) h.cookie = jar.cookie
  if (body !== undefined && !h['content-type']) h['content-type'] = 'application/x-www-form-urlencoded'
  const res = await fetch(new URL(path, BASE), { method, body, headers: h, redirect: 'manual' })
  const setCookie = res.headers.getSetCookie?.() ?? []
  for (const line of setCookie) {
    const pair = line.split(';')[0]
    if (pair.startsWith('dsh_guard=')) jar.cookie = pair
  }
  return { status: res.status, headers: res.headers, text: await res.text() }
}

/** JSON API call: same client, JSON body + browser-like Origin by default. */
async function api(path, { method = 'GET', body, headers = {}, auth = true, jar = main, origin = ORIGIN } = {}) {
  const h = { ...headers }
  if (origin !== null) h.origin = origin
  if (body !== undefined || method === 'POST') h['content-type'] = 'application/json'
  const res = await request(path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: h, auth, jar })
  let json = null
  try {
    json = JSON.parse(res.text)
  } catch {
    json = null
  }
  return { ...res, json }
}

/** The forced `?theme=` boot script marker written by shared/theme.ts. */
const themeMarker = (name) => `document.documentElement.setAttribute('data-theme',"${name}")`
// The old v2 pages hardcoded a dark-only document; v3 keeps `color-scheme:dark`
// inside the dark palette block on purpose, so only the removed declarations
// count as regressions.
const hasHardcodedDark = (page) => page.includes('name="color-scheme" content="dark"') || page.includes('color-scheme:dark;--bg:#0b0d10')

console.log(`dsh-guard e2e against ${BASE}\n`)

// 1. anonymous index redirects to the login page
{
  const res = await request('/', { auth: false })
  const location = res.headers.get('location') ?? ''
  check('anonymous / redirects to /login', res.status === 302 && location.includes('/login'), `${res.status} ${location}`)
}

// 2. an unknown path keeps the original path in `next`
{
  const res = await request('/some/deep/path?x=1', { auth: false })
  const location = decodeURIComponent(res.headers.get('location') ?? '')
  check('unknown path redirects with next', res.status === 302 && location === '/login?next=/some/deep/path?x=1', `${res.status} ${location}`)
}

// 3. the health endpoint answers before authentication is involved
{
  const res = await request('/__guard/health', { auth: false })
  let health = null
  try {
    health = JSON.parse(res.text)
  } catch {
    health = null
  }
  check('health check answers', res.status === 200 && health?.ok === true && health?.service === 'dsh-web-guard', `${res.status}`)
}

// 4. the login page renders a password field, themed by ?theme=
{
  const res = await request('/login', { auth: false })
  check('login page renders a password form', res.status === 200 && res.text.includes('name="password"'), `${res.status}`)
  check('login page carries the shared palette', res.text.includes('--gws-bg') && res.text.includes('prefers-color-scheme: dark'))
  check('login page does not force dark', !res.text.includes(themeMarker('dark')) && !hasHardcodedDark(res.text))
  check('login page follows the system by default', !res.text.includes("setAttribute('data-theme'"))
}
{
  const dark = await request('/login?theme=dark', { auth: false })
  check('login ?theme=dark forces dark', dark.status === 200 && dark.text.includes(themeMarker('dark')))
  check('login ?theme=dark has no hardcoded dark canvas', !hasHardcodedDark(dark.text))
  const light = await request('/login?theme=light', { auth: false })
  check('login ?theme=light forces light', light.status === 200 && light.text.includes(themeMarker('light')))
}
{
  // Own cookie jar: /logout clears a session cookie, and the main jar must stay
  // untouched for the "wrong password sets no cookie" case below.
  const out = await request('/logout?theme=dark', { auth: false, jar: { cookie: '' } })
  check('logout page responds', out.status === 200, `${out.status}`)
  check('logout page is themed', out.text.includes(themeMarker('dark')) && !hasHardcodedDark(out.text))
}

// 5. a wrong password is rejected without a cookie
{
  const res = await request('/login', { method: 'POST', body: formBody('definitely-not-it'), auth: false })
  check('wrong password is rejected', res.status === 401 && !main.cookie, `${res.status}`)
}

// 6. the right password issues a session cookie
{
  const res = await request('/login', { method: 'POST', body: formBody(PASSWORD), auth: false })
  check('correct password issues a session', res.status === 302 && main.cookie.startsWith('dsh_guard='), `${res.status}`)
}

// 7. the authenticated index is the harness UI, with the polyfill injected
{
  const res = await request('/')
  check('authenticated / serves the UI', res.status === 200 && res.text.includes('<html'), `${res.status}`)
  check('polyfill injected into index', res.text.includes('data-dsh-web-guard-polyfill'))
  check('fallback FAB injected into index', res.text.includes('id="dsh-web-guard-fab"'))
  check('fallback FAB uses host theme tokens', res.text.includes('--dsw-alias-bg-layer-2') && res.text.includes('--dsw-alias-bg-mask-3'))
  check('fallback overlay locks overscroll', res.text.includes('overscroll-behavior:contain'))
  check('fallback overlay sizes with dvh', res.text.includes('height:100dvh'))
}

// 8. an /api call is forwarded, not fenced off
{
  const res = await request('/api/skills/list', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })
  check('/api is forwarded (not 403)', res.status !== 403, `${res.status}`)
}

// 9. the JSON API needs a session and never redirects
{
  const res = await request('/__guard/api/state', { auth: false, headers: { origin: ORIGIN } })
  let body = null
  try {
    body = JSON.parse(res.text)
  } catch {
    body = null
  }
  check('API state is 401 without a session', res.status === 401 && body?.ok === false && body?.error === 'unauthorized', `${res.status} ${res.text.slice(0, 80)}`)
  check('API errors never redirect', !res.headers.get('location'), String(res.headers.get('location')))
}

// 10. state shape
let baselineSettings = null
{
  const res = await api('/__guard/api/state')
  const body = res.json
  check('API state answers 200', res.status === 200 && body?.ok === true, `${res.status}`)
  const settings = body?.settings ?? {}
  checkEqual(
    'API state settings shape',
    Object.keys(settings).sort(),
    ['listenHost', 'listenPort', 'lockMinutes', 'maxAttempts', 'repo', 'sessionDays', 'title'],
  )
  check('API state settings are typed', ['sessionDays', 'maxAttempts', 'lockMinutes', 'listenPort'].every((k) => Number.isInteger(settings[k])) && typeof settings.listenHost === 'string' && typeof settings.title === 'string')
  const sessions = Array.isArray(body?.sessions) ? body.sessions : []
  check('API state lists the current session', sessions.some((s) => s.current === true))
  check('API state session row shape', sessions.every((s) => typeof s.id === 'string' && typeof s.ip === 'string' && typeof s.createdAt === 'number' && typeof s.lastSeen === 'number'))
  baselineSettings = settings
}

// 11. mutation guards: method, Origin, content type, field ranges
{
  const wrongMethod = await api('/__guard/api/settings')
  check('API settings rejects GET', wrongMethod.status === 405 && wrongMethod.json?.error === 'method_not_allowed', `${wrongMethod.status}`)

  const wrongType = await request('/__guard/api/settings', { method: 'POST', body: 'maxAttempts=3', headers: { origin: ORIGIN } })
  check('API settings requires JSON content type', wrongType.status === 403, `${wrongType.status}`)

  const wrongOrigin = await api('/__guard/api/settings', { method: 'POST', body: { maxAttempts: 3 }, origin: 'https://evil.example' })
  check('API settings rejects a cross-origin request', wrongOrigin.status === 403 && wrongOrigin.json?.error === 'forbidden', `${wrongOrigin.status}`)

  const zero = await api('/__guard/api/settings', { method: 'POST', body: { maxAttempts: 0 } })
  check('API settings rejects maxAttempts 0', zero.status === 400 && zero.json?.error === 'invalid_field' && zero.json?.field === 'maxAttempts', `${zero.status} ${zero.json?.error}/${zero.json?.field}`)

  const stringy = await api('/__guard/api/settings', { method: 'POST', body: { sessionDays: '7' } })
  check('API settings rejects a non-numeric value', stringy.status === 400 && stringy.json?.error === 'invalid_field' && stringy.json?.field === 'sessionDays')

  const longHost = await api('/__guard/api/settings', { method: 'POST', body: { listenHost: 'x'.repeat(65) } })
  check('API settings rejects a 65-char listenHost', longHost.status === 400 && longHost.json?.error === 'invalid_field' && longHost.json?.field === 'listenHost')
}

// 12. a valid settings round-trip (hot reloadable value, restored afterwards)
{
  const original = baselineSettings
  const desired = original.maxAttempts >= 50 ? 49 : original.maxAttempts + 1
  const updated = await api('/__guard/api/settings', { method: 'POST', body: { maxAttempts: desired } })
  check('API settings update succeeds', updated.status === 200 && updated.json?.ok === true, `${updated.status}`)
  checkEqual('API settings returns the new maxAttempts', updated.json?.settings?.maxAttempts, desired)
  check('API settings reports no restart', updated.json?.restartRequired === false, String(updated.json?.restartRequired))

  const restored = await api('/__guard/api/settings', { method: 'POST', body: { maxAttempts: original.maxAttempts } })
  checkEqual('API settings restored', restored.json?.settings?.maxAttempts, original.maxAttempts)
}

// 13. password change error codes (never succeeds here)
{
  const wrongCurrent = await api('/__guard/api/password', { method: 'POST', body: { current: 'definitely-not-it', next: 'abcdef', confirm: 'abcdef' } })
  check('API password wrong_current', wrongCurrent.status === 400 && wrongCurrent.json?.error === 'wrong_current', `${wrongCurrent.status} ${wrongCurrent.json?.error}`)

  const tooShort = await api('/__guard/api/password', { method: 'POST', body: { current: PASSWORD, next: 'abc', confirm: 'abc' } })
  check('API password too_short', tooShort.status === 400 && tooShort.json?.error === 'too_short', `${tooShort.status} ${tooShort.json?.error}`)

  const mismatch = await api('/__guard/api/password', { method: 'POST', body: { current: PASSWORD, next: 'abcdef', confirm: 'abcdefg' } })
  check('API password mismatch', mismatch.status === 400 && mismatch.json?.error === 'mismatch', `${mismatch.status} ${mismatch.json?.error}`)
}

// 14. the fallback admin page is themed
{
  const res = await request('/__guard/admin?theme=dark')
  check('admin page renders', res.status === 200 && res.text.includes('action="/__guard/admin"'), `${res.status}`)
  check('admin page is themed', res.text.includes(themeMarker('dark')) && res.text.includes('--gws-bg'))
  check('admin page has no hardcoded dark canvas', !hasHardcodedDark(res.text))
}

// 15. kick: a second browser signs in, the first one revokes it
{
  const second = { cookie: '' }
  const login = await request('/login', { method: 'POST', body: formBody(PASSWORD), auth: false, jar: second })
  check('second client signs in', login.status === 302 && second.cookie.startsWith('dsh_guard='), `${login.status}`)

  const state = await api('/__guard/api/state')
  const sessions = state.json?.sessions ?? []
  const other = sessions.find((s) => s.current === false)
  check('state lists the second session', sessions.length >= 2 && Boolean(other), `${sessions.length} rows`)

  if (other) {
    const kicked = await api('/__guard/api/kick', { method: 'POST', body: { id: other.id } })
    check('API kick succeeds', kicked.status === 200 && kicked.json?.ok === true, `${kicked.status}`)
  }
  const probe = await request('/__guard/session', { jar: second })
  check('kicked session is gone', probe.status === 401, `${probe.status}`)

  const missing = await api('/__guard/api/kick', { method: 'POST', body: { id: '0000000000000000' } })
  check('API kick unknown id', missing.status === 404 && missing.json?.error === 'kick_missing', `${missing.status} ${missing.json?.error}`)

  const invalid = await api('/__guard/api/kick', { method: 'POST', body: {} })
  check('API kick missing id field', invalid.status === 400 && invalid.json?.error === 'invalid_field' && invalid.json?.field === 'id')
}

// 16. logout-all clears the session cookie and revokes every session
{
  const res = await api('/__guard/api/logout-all', { method: 'POST' })
  check('API logout-all succeeds', res.status === 200 && res.json?.ok === true, `${res.status}`)
  check('API logout-all clears the cookie', main.cookie === 'dsh_guard=', JSON.stringify(main.cookie))
  const after = await request('/')
  check('after logout-all / redirects', after.status === 302, `${after.status}`)
}

// 17. the form logout route still works
{
  const again = await request('/login', { method: 'POST', body: formBody(PASSWORD), auth: false })
  check('re-login issues a session', again.status === 302 && main.cookie.startsWith('dsh_guard='), `${again.status}`)
  const out = await request('/logout')
  check('logout responds', out.status === 200, `${out.status}`)
  const after = await request('/')
  check('after logout / redirects again', after.status === 302, `${after.status}`)
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
