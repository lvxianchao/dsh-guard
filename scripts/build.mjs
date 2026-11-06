/**
 * Build the publishable artifacts.
 *
 *   lib/*.js      server half, compiled by tsc from src/*.ts (Node ESM)
 *   lib/client.js the browser bundle, a single classic script that registers a
 *                 lazy factory through window.__ModuleLoader__.load()
 *
 * The build is maintainer-side only. The published package ships plain JS, so
 * `dsh plugin add` still needs no toolchain on the user's machine.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const PKG_ID = '@lvxianchao/dsh-web-guard'

process.chdir(ROOT)

rmSync('lib', { recursive: true, force: true })
mkdirSync('lib', { recursive: true })

// 1. Server half: plain Node ESM. tsc owns emit (and the type check).
execFileSync(process.execPath, [join('node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json'], {
  stdio: 'inherit',
})

// 2. Client half: one self-contained script, React supplied by the host module
//    table. esbuild bundles src/client/module.tsx into CJS and the wrapper
//    below turns that into the loader contract's factory closure; `require`
//    inside the factory is the host loader's require, so `react` is resolved
//    against the shared module table instead of being bundled.
const client = await build({
  entryPoints: [join('src', 'client', 'module.tsx')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2022'],
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
})

const bundle = client.outputFiles[0]?.text
if (!bundle) throw new Error('esbuild produced no client bundle')

const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(PKG_ID)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${bundle}
    return module.exports;
  },
});
`
writeFileSync(join('lib', 'client.js'), wrapped)

// 3. Sanity: the artifacts are the shapes the host loads, and the server entry
//    kept its ESM contract.
const entry = readFileSync(join('lib', 'index.js'), 'utf8')
for (const [path, needle, what] of [
  ['lib/index.js', 'export function apply', 'server entry export'],
  ['lib/client.js', 'window.__ModuleLoader__.load', 'client loader registration'],
  ['lib/client.js', JSON.stringify(PKG_ID), 'client bundle id'],
]) {
  if (!readFileSync(join(ROOT, path), 'utf8').includes(needle)) {
    throw new Error(`${path} is missing ${what} (${needle})`)
  }
}
if (!entry.includes('export const inject')) throw new Error('lib/index.js is missing `export const inject`')

console.log(`built ${PKG_ID} → lib/ (index.js + client.js)`)
