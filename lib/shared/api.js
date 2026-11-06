/**
 * The JSON contract between the server half of dsh-web-guard and the React
 * settings page in the client bundle. Both halves compile against this file, so
 * a shape change breaks the build instead of the settings page.
 *
 * Authentication is the ordinary session cookie: the native page lives on the
 * same origin as the harness, so `fetch` with `credentials: 'same-origin'`
 * carries it. Every mutating call is checked against the request `Origin`, and
 * the JSON content type forces a CORS preflight, which makes cross-site form
 * posts from another origin impossible.
 */
/** Route table, relative to the deployment origin. */
export const GUARD_API = {
    state: '/__guard/api/state',
    settings: '/__guard/api/settings',
    password: '/__guard/api/password',
    kick: '/__guard/api/kick',
    logoutAll: '/__guard/api/logout-all',
};
