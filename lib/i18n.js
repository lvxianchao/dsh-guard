/**
 * Locale detection and copy for the guard's own pages.
 *
 * The harness stores the operator's language choice in the profile patch file
 * (`- id: locale` → `config.preference`), which is exactly what the settings UI
 * writes when someone switches language. Reading it means the login and
 * sign-out pages follow the harness instead of guessing from the browser.
 *
 * When no explicit preference exists, the harness falls back to the browser
 * language — and so do we, via Accept-Language.
 */
import { readFileSync, statSync, watch } from 'node:fs';
import { basename, dirname } from 'node:path';
const SUPPORTED = ['zh', 'en'];
/**
 * Read the explicit locale preference from a profile patch file.
 * Returns a supported locale id, or '' when unset/unreadable.
 */
export function readPreference(patchPath) {
    if (!patchPath)
        return '';
    let text;
    try {
        text = readFileSync(patchPath, 'utf8');
    }
    catch {
        return '';
    }
    const lines = text.split('\n');
    let inLocaleRow = false;
    let rowIndent = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const indent = line.length - line.trimStart().length;
        // A new top-level-ish row ends the section we were scanning.
        if (inLocaleRow && /^- /.test(trimmed) && indent <= rowIndent)
            break;
        if (/^-\s+id:\s*['"]?locale['"]?\s*$/.test(trimmed)) {
            inLocaleRow = true;
            rowIndent = indent;
            continue;
        }
        if (inLocaleRow) {
            const m = trimmed.match(/^preference:\s*['"]?([A-Za-z-]+)['"]?/);
            if (m)
                return normalize(m[1]);
        }
    }
    return '';
}
/** Map an arbitrary tag (`zh-CN`, `en-US`) onto a supported id. */
export function normalize(tag) {
    const base = String(tag ?? '').toLowerCase().split(/[-_]/)[0];
    return SUPPORTED.includes(base) ? base : '';
}
const EN = {
    locale: 'en',
    // login page
    loginSubtitle: 'This service requires a password',
    passwordLabel: 'Password',
    passwordPh: 'Enter password',
    submit: 'Continue',
    errWrong: 'Incorrect password',
    errLocked: 'Too many attempts — try again later',
    // sign-out page
    loggedOut: 'Signed out',
    signInAgain: 'Sign in again',
    // shared
    errOrigin: 'Request origin rejected',
};
const ZH = {
    locale: 'zh',
    // login page
    loginSubtitle: '此服务需要密码才能访问',
    passwordLabel: '访问密码',
    passwordPh: '输入密码',
    submit: '进入',
    errWrong: '密码不正确',
    errLocked: '尝试次数过多，请稍后再试',
    // sign-out page
    loggedOut: '已退出登录',
    signInAgain: '重新登录',
    // shared
    errOrigin: '请求来源不合法',
};
const CATALOG = { zh: ZH, en: EN };
/** Copy bundle for a locale, falling back to English. */
export function t(locale) {
    return CATALOG[locale] ?? EN;
}
/**
 * Keep the patch file's locale preference in memory.
 *
 * Reading the file per request would block the harness event loop (this plugin
 * shares its process), and a fixed poll interval is a guess in both directions.
 * Instead: read once at startup, then re-read only when the directory reports a
 * change — the harness writes atomically via rename, so watching the directory
 * is what actually catches the replacement. If the platform has no usable
 * watcher, fall back to a slow mtime check on a timer.
 */
export function createLocaleReader(patchPath) {
    let value = readPreference(patchPath);
    let watcher;
    let poller;
    let mtime = 0;
    let debounce;
    const stamp = () => {
        try {
            return statSync(patchPath).mtimeMs;
        }
        catch {
            return 0;
        }
    };
    mtime = stamp();
    const refresh = () => {
        const next = stamp();
        if (next === mtime)
            return;
        mtime = next;
        value = readPreference(patchPath);
    };
    const schedule = () => {
        if (debounce)
            clearTimeout(debounce);
        debounce = setTimeout(refresh, 40);
        debounce.unref();
    };
    try {
        watcher = watch(dirname(patchPath), { persistent: false }, (_event, filename) => {
            if (!filename || String(filename) === basename(patchPath))
                schedule();
        });
        watcher.on('error', () => {
            watcher?.close();
            watcher = undefined;
        });
    }
    catch {
        watcher = undefined;
    }
    if (!watcher) {
        // No usable watcher: an inexpensive mtime check every 30s is the safety net.
        poller = setInterval(refresh, 30_000);
        poller.unref();
    }
    return {
        get: () => value,
        dispose: () => {
            if (debounce)
                clearTimeout(debounce);
            if (poller)
                clearInterval(poller);
            watcher?.close();
        },
    };
}
