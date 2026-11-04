/**
 * End-to-end check against a running gate.
 *
 *   GUARD_URL=http://127.0.0.1:3081 GUARD_PASSWORD=... node test/e2e.mjs
 *
 * Asserts the documented behaviour only. It deliberately submits one wrong
 * password, so it consumes one of `maxAttempts` before the temporary lock —
 * run it against a test instance if the limit is set very low.
 */
const BASE = (process.env.GUARD_URL ?? 'http://127.0.0.1:3081').replace(/\/$/, '')
const PASSWORD = process.env.GUARD_PASSWORD ?? ''

if (!PASSWORD) {
  console.error('GUARD_PASSWORD is required')
  process.exit(2)
}

let cookie = ''
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

/** Minimal client: fetch does not keep cookies for us. */
async function request(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const h = { ...headers }
  if (auth && cookie) h.cookie = cookie
  if (body !== undefined) h['content-type'] = 'application/x-www-form-urlencoded'
  const res = await fetch(new URL(path, BASE), { method, body, headers: h, redirect: 'manual' })
  const setCookie = res.headers.getSetCookie?.() ?? []
  for (const line of setCookie) {
    const pair = line.split(';')[0]
    if (pair.startsWith('dsh_guard=')) cookie = pair
  }
  return { status: res.status, headers: res.headers, text: await res.text() }
}

console.log(`dsh-guard e2e against ${BASE}\n`)

// 1. anonymous index redirects to the login page
{
  const res = await request('/', { auth: false })
  const location = res.headers.get('location') ?? ''
  check('anonymous / redirects to /login', res.status === 302 && location.includes('/login'), `${res.status} ${location}`)
}

// 2. the login page renders a password field
{
  const res = await request('/login', { auth: false })
  check('login page renders a password form', res.status === 200 && res.text.includes('name="password"'), `${res.status}`)
}

// 3. a wrong password is rejected without a cookie
{
  const res = await request('/login', { method: 'POST', body: 'password=definitely-not-it', auth: false })
  check('wrong password is rejected', res.status === 401 && !cookie, `${res.status}`)
}

// 4. the right password issues a session cookie
{
  const res = await request('/login', { method: 'POST', body: `password=${encodeURIComponent(PASSWORD)}`, auth: false })
  check('correct password issues a session', res.status === 302 && cookie.startsWith('dsh_guard='), `${res.status}`)
}

// 5. the authenticated index is the harness UI, with the polyfill injected
{
  const res = await request('/')
  check('authenticated / serves the UI', res.status === 200 && res.text.includes('<html'), `${res.status}`)
  check('polyfill injected into index', res.text.includes('data-dsh-guard-polyfill'))
}

// 6. an /api call is forwarded, not fenced off
{
  const res = await request('/api/skills/list', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })
  check('/api is forwarded (not 403)', res.status !== 403, `${res.status}`)
}

// 7. logout clears the session
{
  const res = await request('/logout')
  check('logout responds', res.status === 200, `${res.status}`)
  const after = await request('/')
  check('after logout / redirects again', after.status === 302, `${after.status}`)
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
