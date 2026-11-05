/**
 * Transport layer for dsh-web-guard: an HTTP(S) server plus forwarding helpers.
 *
 * This module owns no authentication policy — the caller decides what to
 * forward. Its one job is to make an upstream DeepSeek Harness listener see a
 * loopback request: Host and Origin are rewritten to the upstream authority,
 * which is exactly what the /api browser-trust fence accepts.
 */
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import fs from 'node:fs'
import { URL } from 'node:url'

/** Headers never forwarded verbatim to the upstream. */
const DROP = new Set(['host', 'origin', 'proxy-connection', 'connection', 'keep-alive', 'upgrade', 'transfer-encoding'])

/** Build the upstream header set with loopback authority substitution. */
export function upstreamHeaders(headers, target, cookie) {
  const out = {}
  for (const [key, value] of Object.entries(headers)) {
    if (DROP.has(key.toLowerCase())) continue
    out[key] = value
  }
  out.host = target.host
  // Only restate Origin when the browser sent one: dsh accepts a request
  // without Origin, and a fabricated one would have to stay consistent.
  if (headers.origin !== undefined) out.origin = target.origin
  if (cookie) out.cookie = cookie
  out['x-forwarded-proto'] = target.protocol.replace(':', '')
  return out
}

/**
 * Create the public-facing listener.
 * @param {object} options
 * @param {string} options.host
 * @param {number} options.port
 * @param {string | null} options.tlsCert - PEM chain path, enables HTTPS
 * @param {string | null} options.tlsKey
 * @param {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void} options.handler
 * @param {(req: import('node:http').IncomingMessage, socket: import('node:net').Socket, head: Buffer) => void} options.onUpgrade
 * @param {(line: string) => void} options.log
 */
export function createListener({ host, port, tlsCert, tlsKey, handler, onUpgrade, log }) {
  let server
  if (tlsCert && tlsKey) {
    server = https.createServer(
      { cert: fs.readFileSync(tlsCert), key: fs.readFileSync(tlsKey) },
      wrap(handler, log),
    )
    server.on('tlsClientError', (err) => log(`tls error: ${err.message}`))
  } else {
    server = http.createServer(wrap(handler, log))
  }
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => socket.destroy())
    try {
      onUpgrade(req, socket, head)
    } catch (err) {
      log(`upgrade error: ${err.message}`)
      socket.destroy()
    }
  })
  server.on('clientError', (err, socket) => {
    if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
    socket.destroy()
    log(`client error: ${err.message}`)
  })
  server.on('error', (err) => log(`listener error: ${err.message}`))
  return {
    server,
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(port, host, () => {
        server.removeListener('error', reject)
        resolve()
      })
    }),
    close: () => {
      server.closeAllConnections?.()
      server.close()
    },
  }
}

function wrap(handler, log) {
  return (req, res) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      log(`handler error: ${err?.stack ?? err}`)
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('dsh-web-guard: internal error\n')
      } else {
        res.destroy()
      }
    })
  }
}

/** Forward one HTTP request to the upstream listener. */
export function forward(req, res, { targetOrigin, cookie, agent, log }) {
  const target = new URL(targetOrigin)
  const secure = target.protocol === 'https:'
  const transport = secure ? https : http
  const started = Date.now()
  const proxyReq = transport.request({
    agent: secure ? undefined : agent,
    host: target.hostname,
    port: target.port || (secure ? 443 : 80),
    method: req.method,
    path: req.url,
    headers: upstreamHeaders(req.headers, target, cookie),
    rejectUnauthorized: false,
  }, (proxyRes) => {
    const headers = { ...proxyRes.headers }
    // Never leak the harness cookie to the browser: the guard owns it.
    delete headers['set-cookie']
    res.writeHead(proxyRes.statusCode ?? 502, headers)
    proxyRes.pipe(res)
    // Quiet by default: the Web UI polls constantly. Log failures and slow
    // requests only, so the journal does not fill with 200s.
    proxyRes.on('end', () => {
      const code = proxyRes.statusCode ?? 0
      const ms = Date.now() - started
      if (code >= 400 || ms > 1000) log(`${req.method} ${req.url} ${code} ${ms}ms`)
    })
  })
  proxyReq.on('error', (err) => {
    log(`upstream error ${req.method} ${req.url}: ${err.message}`)
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('dsh-web-guard: upstream unreachable\n')
    } else {
      res.destroy()
    }
  })
  req.pipe(proxyReq)
}

/** Forward a WebSocket (or any HTTP upgrade) with the same header rewrite. */
export function forwardUpgrade(req, socket, head, { targetOrigin, cookie, log }) {
  const target = new URL(targetOrigin)
  const secure = target.protocol === 'https:'
  const port = Number(target.port || (secure ? 443 : 80))
  const lines = [`${req.method} ${req.url} HTTP/1.1`]
  const raw = req.rawHeaders ?? []
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const lower = raw[i].toLowerCase()
    if (lower === 'host' || lower === 'origin' || lower === 'proxy-connection') continue
    lines.push(`${raw[i]}: ${raw[i + 1]}`)
  }
  lines.push(`Host: ${target.host}`)
  if (req.headers.origin !== undefined) lines.push(`Origin: ${target.origin}`)
  if (cookie) lines.push(`Cookie: ${cookie}`)
  lines.push('', '')

  const backend = secure
    ? tls.connect({ host: target.hostname, port, servername: target.hostname, rejectUnauthorized: false })
    : net.connect(port, target.hostname)
  const teardown = (err) => {
    if (err) log(`ws error ${req.url}: ${err.message}`)
    socket.destroy()
    backend.destroy()
  }
  socket.on('error', teardown)
  backend.on('error', teardown)
  socket.on('close', () => backend.destroy())
  backend.on('close', () => socket.destroy())
  backend.on('connect', () => {
    log(`ws ${req.url}`)
    backend.write(lines.join('\r\n'))
    if (head?.length) backend.write(head)
    backend.pipe(socket)
    socket.pipe(backend)
  })
}

/** Shared keep-alive agent for upstream requests. */
export const upstreamAgent = new http.Agent({ keepAlive: true, maxSockets: 128 })
