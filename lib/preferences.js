/**
 * Per-plugin preferences the harness persists in the profile patch file.
 *
 * The harness writes each plugin's user settings as a YAML row in
 * `<profile>/cordis.patch.yml`:
 *
 * ```yaml
 * - id: locale
 *   name: "@deepseek-ai/dsh-client-locale"
 *   config:
 *     preference: zh
 * - id: ui-theme
 *   name: "@deepseek-ai/dsh-client-ui-theme"
 *   config:
 *     preference: dark
 * ```
 *
 * Reading those rows is what lets the guard's standalone pages (login and
 * sign-out, which render before the harness exists) follow the same language
 * and light/dark choice the operator picked inside DSH. Values are read once and
 * refreshed when the file changes; a missing row or unreadable file means "no
 * explicit choice", and the caller falls back to the browser/system.
 */
import { readFileSync, statSync, watch } from 'node:fs';
import { basename, dirname } from 'node:path';
/**
 * Find `preference:` inside the `- id: <rowId>` row.
 * @param text - patch file contents.
 * @param rowId - plugin row id (`locale`, `ui-theme`, …).
 * @returns the raw scalar value, or '' when absent.
 */
export function parseRowPreference(text, rowId) {
    const rowPattern = new RegExp(`^-\\s+id:\\s*['"]?${rowId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\\s*$`);
    const lines = text.split('\n');
    let inRow = false;
    let rowIndent = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const indent = line.length - line.trimStart().length;
        // A new top-level-ish row ends the section we were scanning.
        if (inRow && /^- /.test(trimmed) && indent <= rowIndent)
            break;
        if (!inRow && rowPattern.test(trimmed)) {
            inRow = true;
            rowIndent = indent;
            continue;
        }
        if (inRow) {
            const match = trimmed.match(/^preference:\s*['"]?([A-Za-z0-9_-]+)['"]?/);
            if (match)
                return match[1];
        }
    }
    return '';
}
/**
 * Read one row's preference straight from disk.
 * @param patchPath - profile patch file path.
 * @param rowId - plugin row id.
 * @returns the raw value, or '' when unavailable.
 */
export function readPreference(patchPath, rowId) {
    if (!patchPath)
        return '';
    try {
        return parseRowPreference(readFileSync(patchPath, 'utf8'), rowId);
    }
    catch {
        return '';
    }
}
/**
 * Keep one row's preference in memory.
 *
 * Reading the file per request would block the harness event loop (this plugin
 * shares its process), and a fixed poll interval is a guess in both directions.
 * Instead: read once at startup, then re-read only when the directory reports a
 * change — the harness writes atomically via rename, so watching the directory
 * is what actually catches the replacement. If the platform has no usable
 * watcher, fall back to a slow mtime check on a timer.
 *
 * @param patchPath - profile patch file path.
 * @param rowId - plugin row id.
 * @returns a live reader; call `dispose()` when the plugin unloads.
 */
export function createPreferenceReader(patchPath, rowId) {
    let value = readPreference(patchPath, rowId);
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
        value = readPreference(patchPath, rowId);
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
