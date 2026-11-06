/**
 * Locale detection and copy for the guard's own pages.
 *
 * The harness stores the operator's language choice in the profile patch file
 * (`- id: locale` → `config.preference`), which is exactly what the settings UI
 * writes when someone switches language. Reading it means the login and admin
 * pages follow the harness instead of guessing from the browser.
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
/**
 * Resolve the page locale: explicit preference first, then Accept-Language.
 */
export function detectLocale(patchPath, req) {
    const explicit = readPreference(patchPath);
    if (explicit)
        return explicit;
    const header = String(req?.headers?.['accept-language'] ?? '');
    const first = header.split(',')[0]?.trim();
    return normalize(first) || 'en';
}
/** Relative time in the active language. */
export function ago(ms, locale) {
    if (!ms)
        return '—';
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (locale === 'zh') {
        if (s < 60)
            return `${s} 秒前`;
        if (s < 3600)
            return `${Math.round(s / 60)} 分钟前`;
        if (s < 86400)
            return `${Math.round(s / 3600)} 小时前`;
        return `${Math.round(s / 86400)} 天前`;
    }
    if (s < 60)
        return `${s}s ago`;
    if (s < 3600)
        return `${Math.round(s / 60)} min ago`;
    if (s < 86400)
        return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
}
const EN = {
    locale: 'en',
    adminTitle: 'DSH Web Guard',
    pageTitleAdmin: 'DSH Web Guard',
    backToDsh: 'Back to DSH',
    close: 'Close',
    signOut: 'Sign out',
    secPassword: 'Password',
    hintPassword: 'Leave blank to keep the current one. Other devices stay signed in — use "Sign out everywhere" below if you want them gone.',
    currentPassword: 'Current password',
    currentPasswordPh: 'Required to change it',
    newPassword: 'New password',
    newPasswordPh: 'At least 6 characters',
    confirmPassword: 'Confirm new password',
    confirmPasswordPh: 'Type it again',
    secSession: 'Sessions and lockout',
    hintSession: 'Lifetime counts from the last activity; 0 means the session ends when the browser closes.',
    sessionDays: 'Session lifetime (days)',
    lockMinutes: 'Lockout duration (minutes)',
    maxAttempts: 'Failed attempts before lockout',
    secListen: 'Listener',
    hintListen: 'Takes effect after a DSH restart. A wrong value locks you out of both this page and the public entry — note the current values first.',
    listenHost: 'Listen address',
    listenPort: 'Listen port',
    save: 'Save',
    signOutAll: 'Sign out everywhere',
    confirmSignOutAll: 'This signs out every device, including this one. Continue?',
    secSessions: 'Active sessions',
    hintSessions: 'One row per browser. Sessions are persisted, so restarting DSH keeps everyone signed in — use "Sign out all devices" to revoke them.',
    colSource: 'Source',
    colBrowser: 'Browser',
    colLastSeen: 'Last seen',
    current: 'this device',
    kick: 'Kick',
    emptySessions: 'No other active sessions',
    saved: 'Saved',
    savedPassword: 'Saved — password updated',
    restartNote: 'Listener change recorded; it takes effect after a DSH restart.',
    errCurrent: 'Current password is incorrect',
    errShort: 'New password must be at least 6 characters',
    errMismatch: 'The new passwords do not match',
    errOrigin: 'Request origin rejected',
    kicked: 'Session kicked',
    kickMissing: 'That session no longer exists',
    // login page
    loginSubtitle: 'This service requires a password',
    passwordLabel: 'Password',
    passwordPh: 'Enter password',
    submit: 'Continue',
    errWrong: 'Incorrect password',
    errLocked: 'Too many attempts — try again later',
    loggedOut: 'Signed out',
    signInAgain: 'Sign in again',
};
const ZH = {
    locale: 'zh',
    adminTitle: 'DSH Web Guard',
    pageTitleAdmin: 'DSH Web Guard',
    backToDsh: '返回 DSH',
    close: '关闭',
    signOut: '退出登录',
    secPassword: '登录密码',
    hintPassword: '留空则不修改。修改后其他设备上的会话仍然有效，需要的话用下面的「退出所有设备」。',
    currentPassword: '当前密码',
    currentPasswordPh: '修改密码时必填',
    newPassword: '新密码',
    newPasswordPh: '至少 6 位',
    confirmPassword: '确认新密码',
    confirmPasswordPh: '再输一次',
    secSession: '会话与安全',
    hintSession: '会话有效期从最后一次活动开始计算；改为 0 表示关掉浏览器即失效。',
    sessionDays: '会话有效期（天）',
    lockMinutes: '锁定时间（分钟）',
    maxAttempts: '连续失败次数上限',
    secListen: '监听',
    hintListen: '修改后需要重启 DSH 才生效；填错会导致管理页和外网入口都连不上，确认前先记下原值。',
    listenHost: '监听地址',
    listenPort: '监听端口',
    save: '保存',
    signOutAll: '退出所有设备',
    confirmSignOutAll: '将退出所有设备上的登录，包括当前这个。继续？',
    secSessions: '活跃会话',
    hintSessions: '每个浏览器一条记录。会话落盘保存，重启 DSH 不会把人踢下线；要全员下线请点「退出所有设备」。',
    colSource: '来源',
    colBrowser: '浏览器',
    colLastSeen: '最后活动',
    current: '当前',
    kick: '踢出',
    emptySessions: '当前没有其他活跃会话',
    saved: '已保存',
    savedPassword: '已保存，密码已更新',
    restartNote: '监听地址/端口已记录，重启 DSH 后才会生效。',
    errCurrent: '当前密码不正确',
    errShort: '新密码至少 6 位',
    errMismatch: '两次输入的新密码不一致',
    errOrigin: '请求来源不合法',
    kicked: '已踢出该会话',
    kickMissing: '该会话已不存在',
    // login page
    loginSubtitle: '此服务需要密码才能访问',
    passwordLabel: '访问密码',
    passwordPh: '输入密码',
    submit: '进入',
    errWrong: '密码不正确',
    errLocked: '尝试次数过多，请稍后再试',
    loggedOut: '已退出登录',
    signInAgain: '重新登录',
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
