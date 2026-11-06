window.__ModuleLoader__.load({
  id: "@lvxianchao/dsh-web-guard",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/module.tsx
var module_exports = {};
__export(module_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(module_exports);

// src/client/GuardSettings.tsx
var import_react = require("react");

// src/shared/api.ts
var GUARD_API = {
  state: "/__guard/api/state",
  settings: "/__guard/api/settings",
  password: "/__guard/api/password",
  kick: "/__guard/api/kick",
  logoutAll: "/__guard/api/logout-all"
};

// src/client/api.ts
var ERROR_CODES = /* @__PURE__ */ new Set([
  "unauthorized",
  "forbidden",
  "invalid_body",
  "invalid_field",
  "wrong_current",
  "too_short",
  "mismatch",
  "not_found",
  "method_not_allowed",
  "kick_missing",
  "restart_required"
]);
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isErrorCode(value) {
  return typeof value === "string" && ERROR_CODES.has(value);
}
async function request(path, init) {
  let response;
  try {
    response = await fetch(path, { ...init, credentials: "same-origin" });
  } catch {
    return { ok: false, error: "network_error" };
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = void 0;
  }
  if (!isRecord(payload) || payload.ok !== true) {
    const error = isRecord(payload) && isErrorCode(payload.error) ? payload.error : "unknown_error";
    const field = isRecord(payload) && typeof payload.field === "string" ? payload.field : void 0;
    return field === void 0 ? { ok: false, error } : { ok: false, error, field };
  }
  return { ok: true, data: payload };
}
function post(path, body) {
  let serialized;
  try {
    serialized = JSON.stringify(body);
  } catch {
    return Promise.resolve({ ok: false, error: "invalid_body" });
  }
  return request(path, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: serialized
  });
}
function fetchGuardState() {
  return request(GUARD_API.state, {
    method: "GET",
    headers: { accept: "application/json" }
  });
}
function updateGuardSettings(update) {
  return post(GUARD_API.settings, update);
}
function changeGuardPassword(change) {
  return post(GUARD_API.password, change);
}
function kickGuardSession(kick) {
  return post(GUARD_API.kick, kick);
}
function signOutAllDevices() {
  return post(GUARD_API.logoutAll, {});
}

// src/client/GuardSettings.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var LIMITS = {
  sessionDays: { min: 0, max: 365 },
  maxAttempts: { min: 1, max: 50 },
  lockMinutes: { min: 1, max: 1440 },
  listenPort: { min: 1, max: 65535 }
};
var NOTICE_MS = 4e3;
var ERROR_KEYS = {
  unauthorized: "error.unauthorized",
  forbidden: "error.forbidden",
  invalid_body: "error.invalid_body",
  invalid_field: "error.invalid_field",
  wrong_current: "error.wrong_current",
  too_short: "error.too_short",
  mismatch: "error.mismatch",
  not_found: "error.not_found",
  method_not_allowed: "error.method_not_allowed",
  kick_missing: "error.kick_missing",
  restart_required: "error.restart_required",
  network_error: "error.network",
  unknown_error: "error.unknown"
};
var FIELD_KEYS = {
  sessionDays: "field.sessionDays",
  maxAttempts: "field.maxAttempts",
  lockMinutes: "field.lockMinutes",
  listenHost: "field.listenHost",
  listenPort: "field.listenPort"
};
var EMPTY_DRAFT = {
  sessionDays: "",
  maxAttempts: "",
  lockMinutes: "",
  listenHost: "",
  listenPort: ""
};
function textValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value;
  return "";
}
function draftOf(view) {
  return {
    sessionDays: textValue(view?.sessionDays),
    maxAttempts: textValue(view?.maxAttempts),
    lockMinutes: textValue(view?.lockMinutes),
    listenHost: textValue(view?.listenHost),
    listenPort: textValue(view?.listenPort)
  };
}
function withDraftField(current, key, value) {
  const next = { ...current };
  next[key] = value;
  return next;
}
function parseInteger(value) {
  const trimmed = value.trim();
  if (trimmed === "" || !/^\d+$/u.test(trimmed)) return void 0;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : void 0;
}
function inRange(value, min, max) {
  return value !== void 0 && Number.isFinite(value) && value >= min && value <= max;
}
function makeTranslate(t) {
  if (typeof t === "function") return t;
  return (key) => key;
}
function invalidField(t, fieldKey) {
  return t("error.invalid_field", { field: t(fieldKey) });
}
function describeError(t, failure) {
  if (failure.error === "invalid_field" && failure.field !== void 0) {
    const key2 = FIELD_KEYS[failure.field];
    return t("error.invalid_field", { field: key2 === void 0 ? failure.field : t(key2) });
  }
  const key = ERROR_KEYS[failure.error];
  if (key !== void 0) return t(key);
  return t("error.generic", { error: failure.error });
}
function formatDateTime(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "\u2014";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "\u2014";
  }
}
function userAgentText(ua) {
  const trimmed = typeof ua === "string" ? ua.trim() : "";
  return trimmed === "" ? "\u2014" : trimmed;
}
function useTransientNotice(notice, setNotice) {
  (0, import_react.useEffect)(() => {
    if (notice === void 0 || notice.kind !== "ok") return void 0;
    const timer = window.setTimeout(() => {
      setNotice(void 0);
    }, NOTICE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [notice, setNotice]);
}
function Field(props) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "wg-field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { className: "wg-label", htmlFor: props.id, children: props.label }),
    props.children,
    props.hint === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "wg-hint", children: props.hint })
  ] });
}
function NoticeLine(props) {
  if (props.notice === void 0) return null;
  const failed = props.notice.kind === "error";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: failed ? "wg-notice wg-noticeError" : "wg-notice wg-noticeOk", role: failed ? "alert" : "status", children: props.notice.text });
}
function GuardSettings({ t }) {
  const translate = makeTranslate(t);
  const translateRef = (0, import_react.useRef)(translate);
  translateRef.current = translate;
  const [state, setState] = (0, import_react.useState)(void 0);
  const [draft, setDraft] = (0, import_react.useState)(EMPTY_DRAFT);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [loadError, setLoadError] = (0, import_react.useState)(void 0);
  const [reloadTick, setReloadTick] = (0, import_react.useState)(0);
  const [policyBusy, setPolicyBusy] = (0, import_react.useState)(false);
  const [policyNotice, setPolicyNotice] = (0, import_react.useState)(void 0);
  const [listenerBusy, setListenerBusy] = (0, import_react.useState)(false);
  const [listenerNotice, setListenerNotice] = (0, import_react.useState)(void 0);
  const [listenerRestart, setListenerRestart] = (0, import_react.useState)(false);
  const [currentPassword, setCurrentPassword] = (0, import_react.useState)("");
  const [nextPassword, setNextPassword] = (0, import_react.useState)("");
  const [confirmPassword, setConfirmPassword] = (0, import_react.useState)("");
  const [passwordBusy, setPasswordBusy] = (0, import_react.useState)(false);
  const [passwordNotice, setPasswordNotice] = (0, import_react.useState)(void 0);
  const [kicking, setKicking] = (0, import_react.useState)("");
  const [sessionsNotice, setSessionsNotice] = (0, import_react.useState)(void 0);
  const [signOutBusy, setSignOutBusy] = (0, import_react.useState)(false);
  const [signOutNotice, setSignOutNotice] = (0, import_react.useState)(void 0);
  const [signedOut, setSignedOut] = (0, import_react.useState)(false);
  useTransientNotice(policyNotice, setPolicyNotice);
  useTransientNotice(listenerNotice, setListenerNotice);
  useTransientNotice(passwordNotice, setPasswordNotice);
  useTransientNotice(sessionsNotice, setSessionsNotice);
  useTransientNotice(signOutNotice, setSignOutNotice);
  (0, import_react.useEffect)(() => {
    let alive = true;
    setLoading(true);
    fetchGuardState().then((result) => {
      if (!alive) return;
      if (result.ok) {
        setState(result.data);
        setDraft(draftOf(result.data.settings));
        setListenerRestart(result.data.restartRequired === true);
        setLoadError(void 0);
      } else {
        setLoadError({
          text: describeError(translateRef.current, result),
          unauthorized: result.error === "unauthorized"
        });
      }
      setLoading(false);
    }).catch((error) => {
      if (!alive) return;
      setLoadError({
        text: translateRef.current("error.generic", { error: String(error) }),
        unauthorized: false
      });
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [reloadTick]);
  const acceptSettings = (view) => {
    setState((current) => current === void 0 ? current : { ...current, settings: view });
  };
  const onDraft = (key) => (event) => {
    const value = event.target.value;
    setDraft((current) => withDraftField(current, key, value));
  };
  const applySettingsResult = (result, onSuccess, successText, setNotice) => {
    if (!result.ok) {
      setNotice({ kind: "error", text: describeError(translateRef.current, result) });
      return;
    }
    acceptSettings(result.data.settings);
    onSuccess(result.data);
    setNotice({ kind: "ok", text: successText(result.data) });
  };
  const savePolicy = async (event) => {
    event.preventDefault();
    const t0 = translateRef.current;
    const sessionDays = parseInteger(draft.sessionDays);
    const maxAttempts = parseInteger(draft.maxAttempts);
    const lockMinutes = parseInteger(draft.lockMinutes);
    if (!inRange(sessionDays, LIMITS.sessionDays.min, LIMITS.sessionDays.max)) {
      setPolicyNotice({ kind: "error", text: invalidField(t0, "field.sessionDays") });
      return;
    }
    if (!inRange(maxAttempts, LIMITS.maxAttempts.min, LIMITS.maxAttempts.max)) {
      setPolicyNotice({ kind: "error", text: invalidField(t0, "field.maxAttempts") });
      return;
    }
    if (!inRange(lockMinutes, LIMITS.lockMinutes.min, LIMITS.lockMinutes.max)) {
      setPolicyNotice({ kind: "error", text: invalidField(t0, "field.lockMinutes") });
      return;
    }
    setPolicyBusy(true);
    setPolicyNotice(void 0);
    try {
      const result = await updateGuardSettings({ sessionDays, maxAttempts, lockMinutes });
      applySettingsResult(
        result,
        (data) => {
          setDraft((current) => ({
            ...current,
            sessionDays: textValue(data.settings.sessionDays),
            maxAttempts: textValue(data.settings.maxAttempts),
            lockMinutes: textValue(data.settings.lockMinutes)
          }));
        },
        () => t0("policy.saved"),
        setPolicyNotice
      );
    } finally {
      setPolicyBusy(false);
    }
  };
  const saveListener = async (event) => {
    event.preventDefault();
    const t0 = translateRef.current;
    const listenHost = draft.listenHost.trim();
    const listenPort = parseInteger(draft.listenPort);
    if (listenHost === "" || listenHost.length > 64) {
      setListenerNotice({ kind: "error", text: invalidField(t0, "field.listenHost") });
      return;
    }
    if (!inRange(listenPort, LIMITS.listenPort.min, LIMITS.listenPort.max)) {
      setListenerNotice({ kind: "error", text: invalidField(t0, "field.listenPort") });
      return;
    }
    setListenerBusy(true);
    setListenerNotice(void 0);
    setListenerRestart(false);
    try {
      const result = await updateGuardSettings({ listenHost, listenPort });
      applySettingsResult(
        result,
        (data) => {
          setDraft((current) => ({
            ...current,
            listenHost: textValue(data.settings.listenHost),
            listenPort: textValue(data.settings.listenPort)
          }));
          setListenerRestart(data.restartRequired === true);
        },
        (data) => data.restartRequired ? t0("listener.restartRequired") : t0("listener.saved"),
        setListenerNotice
      );
    } finally {
      setListenerBusy(false);
    }
  };
  const savePassword = async (event) => {
    event.preventDefault();
    const t0 = translateRef.current;
    if (currentPassword === "") {
      setPasswordNotice({ kind: "error", text: t0("password.requiredCurrent") });
      return;
    }
    if (nextPassword === "") {
      setPasswordNotice({ kind: "error", text: t0("password.requiredNext") });
      return;
    }
    if (nextPassword.length < 6) {
      setPasswordNotice({ kind: "error", text: t0("error.too_short") });
      return;
    }
    if (nextPassword !== confirmPassword) {
      setPasswordNotice({ kind: "error", text: t0("error.mismatch") });
      return;
    }
    setPasswordBusy(true);
    setPasswordNotice(void 0);
    try {
      const result = await changeGuardPassword({
        current: currentPassword,
        next: nextPassword,
        confirm: confirmPassword
      });
      if (!result.ok) {
        setPasswordNotice({ kind: "error", text: describeError(t0, result) });
        return;
      }
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      setPasswordNotice({ kind: "ok", text: t0("password.saved") });
    } finally {
      setPasswordBusy(false);
    }
  };
  const refreshSessions = () => {
    setSessionsNotice(void 0);
    setReloadTick((value) => value + 1);
  };
  const kickSession = async (id) => {
    const t0 = translateRef.current;
    setKicking(id);
    setSessionsNotice(void 0);
    try {
      const result = await kickGuardSession({ id });
      if (!result.ok) {
        setSessionsNotice({ kind: "error", text: describeError(t0, result) });
        return;
      }
      setState(
        (current) => current === void 0 ? current : { ...current, sessions: current.sessions.filter((session) => session.id !== id) }
      );
      setSessionsNotice({ kind: "ok", text: t0("sessions.kicked") });
    } finally {
      setKicking("");
    }
  };
  const signOutEverywhere = async () => {
    const t0 = translateRef.current;
    let confirmed = false;
    try {
      confirmed = window.confirm(t0("signout.confirm"));
    } catch {
      confirmed = false;
    }
    if (!confirmed) return;
    setSignOutBusy(true);
    setSignOutNotice(void 0);
    try {
      const result = await signOutAllDevices();
      if (!result.ok) {
        setSignOutNotice({ kind: "error", text: describeError(t0, result) });
        return;
      }
      setSignedOut(true);
      setState((current) => current === void 0 ? current : { ...current, sessions: [] });
      setSignOutNotice({ kind: "ok", text: t0("signout.done") });
    } finally {
      setSignOutBusy(false);
    }
  };
  const sessions = state !== void 0 && Array.isArray(state.sessions) ? state.sessions.filter((session) => session !== null && typeof session === "object") : [];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "wg-root", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { className: "wg-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "wg-title", children: translate("settings.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "wg-lead", children: translate("settings.lead") })
    ] }),
    loadError === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "wg-card", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "wg-notice wg-noticeError", role: "alert", children: loadError.text }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "wg-actions", children: [
        loadError.unauthorized ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { className: "wg-btn", href: "/login", children: translate("signout.goLogin") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            className: "wg-btn",
            onClick: () => {
              setReloadTick((value) => value + 1);
            },
            children: translate("common.retry")
          }
        )
      ] })
    ] }),
    loading && state === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "wg-hint", role: "status", children: translate("common.loading") }) : null,
    state === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "wg-card", "aria-labelledby": "wg-policy-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "wg-cardTitle", id: "wg-policy-title", children: translate("policy.section") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "wg-cardHint", children: translate("policy.description") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "form",
          {
            onSubmit: (event) => {
              void savePolicy(event);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "wg-grid", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  Field,
                  {
                    id: "wg-session-days",
                    label: translate("policy.sessionDays"),
                    hint: translate("policy.sessionDaysHint"),
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "input",
                      {
                        id: "wg-session-days",
                        className: "wg-input",
                        type: "number",
                        inputMode: "numeric",
                        min: LIMITS.sessionDays.min,
                        max: LIMITS.sessionDays.max,
                        step: 1,
                        value: draft.sessionDays,
                        disabled: policyBusy,
                        onChange: onDraft("sessionDays")
                      }
                    )
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  Field,
                  {
                    id: "wg-max-attempts",
                    label: translate("policy.maxAttempts"),
                    hint: translate("policy.maxAttemptsHint"),
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "input",
                      {
                        id: "wg-max-attempts",
                        className: "wg-input",
                        type: "number",
                        inputMode: "numeric",
                        min: LIMITS.maxAttempts.min,
                        max: LIMITS.maxAttempts.max,
                        step: 1,
                        value: draft.maxAttempts,
                        disabled: policyBusy,
                        onChange: onDraft("maxAttempts")
                      }
                    )
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  Field,
                  {
                    id: "wg-lock-minutes",
                    label: translate("policy.lockMinutes"),
                    hint: translate("policy.lockMinutesHint"),
                    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      "input",
                      {
                        id: "wg-lock-minutes",
                        className: "wg-input",
                        type: "number",
                        inputMode: "numeric",
                        min: LIMITS.lockMinutes.min,
                        max: LIMITS.lockMinutes.max,
                        step: 1,
                        value: draft.lockMinutes,
                        disabled: policyBusy,
                        onChange: onDraft("lockMinutes")
                      }
                    )
                  }
                )
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoticeLine, { notice: policyNotice }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "wg-actions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", className: "wg-btn wg-btnPrimary", disabled: policyBusy, children: policyBusy ? translate("common.saving") : translate("policy.save") }) })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "wg-card", "aria-labelledby": "wg-password-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "wg-cardTitle", id: "wg-password-title", children: translate("password.section") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "wg-cardHint", children: translate("password.description") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "form",
          {
            onSubmit: (event) => {
              void savePassword(event);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "wg-grid", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { id: "wg-password-current", label: translate("password.current"), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "input",
                  {
                    id: "wg-password-current",
                    className: "wg-input",
                    type: "password",
                    autoComplete: "current-password",
                    value: currentPassword,
                    disabled: passwordBusy,
                    onChange: (event) => {
                      setCurrentPassword(event.target.value);
                    }
                  }
                ) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { id: "wg-password-next", label: translate("password.next"), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "input",
                  {
                    id: "wg-password-next",
                    className: "wg-input",
                    type: "password",
                    autoComplete: "new-password",
                    value: nextPassword,
                    disabled: passwordBusy,
                    onChange: (event) => {
                      setNextPassword(event.target.value);
                    }
                  }
                ) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { id: "wg-password-confirm", label: translate("password.confirm"), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "input",
                  {
                    id: "wg-password-confirm",
                    className: "wg-input",
                    type: "password",
                    autoComplete: "new-password",
                    value: confirmPassword,
                    disabled: passwordBusy,
                    onChange: (event) => {
                      setConfirmPassword(event.target.value);
                    }
                  }
                ) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoticeLine, { notice: passwordNotice }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "wg-actions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", className: "wg-btn wg-btnPrimary", disabled: passwordBusy, children: passwordBusy ? translate("common.saving") : translate("password.submit") }) })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "wg-card", "aria-labelledby": "wg-listener-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { className: "wg-cardTitle", id: "wg-listener-title", children: [
          translate("listener.section"),
          listenerRestart ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "wg-badge", children: translate("listener.restartBadge") }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "wg-cardHint", children: translate("listener.description") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "form",
          {
            onSubmit: (event) => {
              void saveListener(event);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "wg-grid wg-gridTwo", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { id: "wg-listen-host", label: translate("listener.host"), hint: translate("listener.hostHint"), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "input",
                  {
                    id: "wg-listen-host",
                    className: "wg-input",
                    type: "text",
                    maxLength: 64,
                    spellCheck: false,
                    autoComplete: "off",
                    value: draft.listenHost,
                    disabled: listenerBusy,
                    onChange: onDraft("listenHost")
                  }
                ) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, { id: "wg-listen-port", label: translate("listener.port"), hint: translate("listener.portHint"), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "input",
                  {
                    id: "wg-listen-port",
                    className: "wg-input",
                    type: "number",
                    inputMode: "numeric",
                    min: LIMITS.listenPort.min,
                    max: LIMITS.listenPort.max,
                    step: 1,
                    value: draft.listenPort,
                    disabled: listenerBusy,
                    onChange: onDraft("listenPort")
                  }
                ) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoticeLine, { notice: listenerNotice }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "wg-actions", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "submit", className: "wg-btn wg-btnPrimary", disabled: listenerBusy, children: listenerBusy ? translate("common.saving") : translate("listener.save") }) })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "wg-card", "aria-labelledby": "wg-sessions-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "wg-sectionHead", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "wg-cardTitle", id: "wg-sessions-title", children: translate("sessions.section") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "wg-cardHint", children: translate("sessions.description") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "wg-btn", disabled: loading, onClick: refreshSessions, children: translate("sessions.refresh") })
        ] }),
        sessions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "wg-empty", children: translate("sessions.empty") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "wg-tableWrap", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { className: "wg-table", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { scope: "col", children: translate("sessions.ip") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { scope: "col", children: translate("sessions.ua") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { scope: "col", children: translate("sessions.lastSeen") }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { scope: "col", "aria-label": translate("sessions.kick") })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: sessions.map((session) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { className: "wg-cellIp", children: [
              typeof session.ip === "string" && session.ip !== "" ? session.ip : "\u2014",
              session.current === true ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "wg-badge", children: translate("sessions.current") }) : null
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "wg-cellUa", title: userAgentText(session.ua), children: userAgentText(session.ua) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", { className: "wg-cellTime", children: [
              formatDateTime(session.lastSeen),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "wg-cellTimeDim", children: translate("sessions.signedIn", { time: formatDateTime(session.createdAt) }) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { className: "wg-cellAction", children: session.current ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: "wg-btn wg-btnDanger",
                disabled: kicking !== "",
                onClick: () => {
                  void kickSession(session.id);
                },
                children: kicking === session.id ? translate("sessions.kicking") : translate("sessions.kick")
              }
            ) })
          ] }, session.id)) })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoticeLine, { notice: sessionsNotice })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: "wg-card", "aria-labelledby": "wg-signout-title", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { className: "wg-cardTitle", id: "wg-signout-title", children: translate("signout.section") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "wg-cardHint", children: translate("signout.description") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoticeLine, { notice: signOutNotice }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "wg-actions", children: signedOut ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { className: "wg-btn wg-btnPrimary", href: "/login", children: translate("signout.goLogin") }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            className: "wg-btn wg-btnDanger",
            disabled: signOutBusy,
            onClick: () => {
              void signOutEverywhere();
            },
            children: signOutBusy ? translate("common.saving") : translate("signout.action")
          }
        ) })
      ] })
    ] })
  ] });
}

// src/client/locales.ts
var zh = {
  "settings.title": "\u5B89\u5168",
  "settings.lead": "\u767B\u5F55\u5BC6\u7801\u4E0E\u8BBF\u95EE\u63A7\u5236\u7531 dsh-web-guard \u7BA1\u7406\u3002",
  "common.loading": "\u52A0\u8F7D\u4E2D\u2026",
  "common.retry": "\u91CD\u8BD5",
  "common.saving": "\u4FDD\u5B58\u4E2D\u2026",
  "policy.section": "\u5B89\u5168\u7B56\u7565",
  "policy.description": "\u63A7\u5236\u767B\u5F55\u4F1A\u8BDD\u7684\u6709\u6548\u671F\uFF0C\u4EE5\u53CA\u8FDE\u7EED\u767B\u5F55\u5931\u8D25\u540E\u7684\u9501\u5B9A\u7B56\u7565\u3002",
  "policy.sessionDays": "\u4F1A\u8BDD\u6709\u6548\u671F\uFF08\u5929\uFF09",
  "policy.sessionDaysHint": "0 \u8868\u793A\u4EC5\u5728\u6D4F\u89C8\u5668\u4F1A\u8BDD\u5185\u6709\u6548\uFF1B\u8303\u56F4 0\u2013365\u3002",
  "policy.maxAttempts": "\u6700\u5927\u5931\u8D25\u5C1D\u8BD5\u6B21\u6570",
  "policy.maxAttemptsHint": "\u8FDE\u7EED\u5931\u8D25\u8FBE\u5230\u8BE5\u6B21\u6570\u540E\u9501\u5B9A\u6765\u6E90\u5730\u5740\uFF1B\u8303\u56F4 1\u201350\u3002",
  "policy.lockMinutes": "\u9501\u5B9A\u65F6\u957F\uFF08\u5206\u949F\uFF09",
  "policy.lockMinutesHint": "\u8303\u56F4 1\u20131440\u3002",
  "policy.save": "\u4FDD\u5B58\u7B56\u7565",
  "policy.saved": "\u5B89\u5168\u7B56\u7565\u5DF2\u4FDD\u5B58\u3002",
  "password.section": "\u4FEE\u6539\u5BC6\u7801",
  "password.description": "\u65B0\u5BC6\u7801\u81F3\u5C11 6 \u4E2A\u5B57\u7B26\u3002\u4FEE\u6539\u540E\uFF0C\u65B0\u7684\u767B\u5F55\u9700\u8981\u4F7F\u7528\u65B0\u5BC6\u7801\u3002",
  "password.current": "\u5F53\u524D\u5BC6\u7801",
  "password.next": "\u65B0\u5BC6\u7801",
  "password.confirm": "\u786E\u8BA4\u65B0\u5BC6\u7801",
  "password.submit": "\u66F4\u65B0\u5BC6\u7801",
  "password.saved": "\u5BC6\u7801\u5DF2\u66F4\u65B0\u3002",
  "password.requiredCurrent": "\u8BF7\u8F93\u5165\u5F53\u524D\u5BC6\u7801\u3002",
  "password.requiredNext": "\u8BF7\u8F93\u5165\u65B0\u5BC6\u7801\u3002",
  "listener.section": "\u76D1\u542C\u5730\u5740",
  "listener.description": "DSH \u7F51\u5173\u76D1\u542C\u7684\u5730\u5740\u4E0E\u7AEF\u53E3\u3002\u4FEE\u6539\u540E\u9700\u8981\u91CD\u542F DSH \u624D\u80FD\u751F\u6548\u3002",
  "listener.host": "\u76D1\u542C\u5730\u5740",
  "listener.hostHint": "\u4F8B\u5982 0.0.0.0 \u6216 127.0.0.1\uFF1B\u6700\u591A 64 \u4E2A\u5B57\u7B26\u3002",
  "listener.port": "\u7AEF\u53E3",
  "listener.portHint": "\u8303\u56F4 1\u201365535\u3002",
  "listener.save": "\u4FDD\u5B58\u76D1\u542C\u8BBE\u7F6E",
  "listener.saved": "\u76D1\u542C\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\u3002",
  "listener.restartRequired": "\u76D1\u542C\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u91CD\u542F DSH \u540E\u751F\u6548\u3002",
  "listener.restartBadge": "\u91CD\u542F\u751F\u6548",
  "sessions.section": "\u6D3B\u8DC3\u4F1A\u8BDD",
  "sessions.description": "\u5F53\u524D\u4ECD\u6709\u6548\u7684\u767B\u5F55\u4F1A\u8BDD\u3002\u8E22\u51FA\u540E\u8BE5\u8BBE\u5907\u9700\u8981\u91CD\u65B0\u767B\u5F55\u3002",
  "sessions.empty": "\u6682\u65E0\u6D3B\u8DC3\u4F1A\u8BDD\u3002",
  "sessions.ip": "IP",
  "sessions.ua": "\u6D4F\u89C8\u5668",
  "sessions.lastSeen": "\u6700\u540E\u6D3B\u52A8",
  "sessions.signedIn": "\u767B\u5F55\u4E8E {time}",
  "sessions.current": "\u672C\u673A",
  "sessions.kick": "\u8E22\u51FA",
  "sessions.kicking": "\u8E22\u51FA\u4E2D\u2026",
  "sessions.kicked": "\u5DF2\u8E22\u51FA\u8BE5\u4F1A\u8BDD\u3002",
  "sessions.refresh": "\u5237\u65B0",
  "signout.section": "\u9000\u51FA\u6240\u6709\u8BBE\u5907",
  "signout.description": "\u7ACB\u5373\u4EE4\u6240\u6709\u8BBE\u5907\u4E0A\u7684\u767B\u5F55\u4F1A\u8BDD\u5931\u6548\uFF0C\u5305\u62EC\u5F53\u524D\u8BBE\u5907\u3002",
  "signout.action": "\u9000\u51FA\u6240\u6709\u8BBE\u5907",
  "signout.confirm": "\u786E\u5B9A\u8981\u9000\u51FA\u6240\u6709\u8BBE\u5907\u5417\uFF1F\u5F53\u524D\u9875\u9762\u4E5F\u9700\u8981\u91CD\u65B0\u767B\u5F55\u3002",
  "signout.done": "\u5DF2\u9000\u51FA\u6240\u6709\u8BBE\u5907\u3002",
  "signout.goLogin": "\u524D\u5F80\u767B\u5F55\u9875",
  "field.sessionDays": "\u4F1A\u8BDD\u6709\u6548\u671F",
  "field.maxAttempts": "\u6700\u5927\u5931\u8D25\u5C1D\u8BD5\u6B21\u6570",
  "field.lockMinutes": "\u9501\u5B9A\u65F6\u957F",
  "field.listenHost": "\u76D1\u542C\u5730\u5740",
  "field.listenPort": "\u76D1\u542C\u7AEF\u53E3",
  "error.unauthorized": "\u767B\u5F55\u72B6\u6001\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55\u3002",
  "error.forbidden": "\u8BF7\u6C42\u88AB\u62D2\u7EDD\uFF08\u8DE8\u7AD9\u8BF7\u6C42\u6216\u6743\u9650\u4E0D\u8DB3\uFF09\u3002",
  "error.invalid_body": "\u8BF7\u6C42\u5185\u5BB9\u65E0\u6548\u3002",
  "error.invalid_field": "\u201C{field}\u201D\u7684\u503C\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u5141\u8BB8\u8303\u56F4\u3002",
  "error.wrong_current": "\u5F53\u524D\u5BC6\u7801\u4E0D\u6B63\u786E\u3002",
  "error.too_short": "\u65B0\u5BC6\u7801\u81F3\u5C11\u9700\u8981 6 \u4E2A\u5B57\u7B26\u3002",
  "error.mismatch": "\u4E24\u6B21\u8F93\u5165\u7684\u65B0\u5BC6\u7801\u4E0D\u4E00\u81F4\u3002",
  "error.not_found": "\u63A5\u53E3\u4E0D\u5B58\u5728\uFF0C\u8BF7\u786E\u8BA4\u670D\u52A1\u7AEF\u7248\u672C\u3002",
  "error.method_not_allowed": "\u8BE5\u63A5\u53E3\u4E0D\u652F\u6301\u8FD9\u79CD\u8BF7\u6C42\u65B9\u5F0F\u3002",
  "error.kick_missing": "\u8BE5\u4F1A\u8BDD\u5DF2\u4E0D\u5B58\u5728\uFF0C\u5217\u8868\u53EF\u80FD\u5DF2\u8FC7\u671F\u3002",
  "error.restart_required": "\u9700\u8981\u91CD\u542F DSH \u624D\u80FD\u5E94\u7528\u8BE5\u6539\u52A8\u3002",
  "error.network": "\u65E0\u6CD5\u8FDE\u63A5\u5230\u670D\u52A1\u5668\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5\u3002",
  "error.unknown": "\u670D\u52A1\u5668\u8FD4\u56DE\u4E86\u65E0\u6CD5\u8BC6\u522B\u7684\u54CD\u5E94\u3002",
  "error.generic": "\u64CD\u4F5C\u5931\u8D25\uFF1A{error}"
};
var en = {
  "settings.title": "Security",
  "settings.lead": "Sign-in password and access control are managed by dsh-web-guard.",
  "common.loading": "Loading\u2026",
  "common.retry": "Retry",
  "common.saving": "Saving\u2026",
  "policy.section": "Security policy",
  "policy.description": "Control how long signed-in sessions last and how repeated failures lock the source address.",
  "policy.sessionDays": "Session lifetime (days)",
  "policy.sessionDaysHint": "0 keeps the session for the browser session only; range 0\u2013365.",
  "policy.maxAttempts": "Maximum failed attempts",
  "policy.maxAttemptsHint": "The source address is locked after this many consecutive failures; range 1\u201350.",
  "policy.lockMinutes": "Lockout duration (minutes)",
  "policy.lockMinutesHint": "Range 1\u20131440.",
  "policy.save": "Save policy",
  "policy.saved": "Security policy saved.",
  "password.section": "Change password",
  "password.description": "At least 6 characters. After the change, new sign-ins must use the new password.",
  "password.current": "Current password",
  "password.next": "New password",
  "password.confirm": "Confirm new password",
  "password.submit": "Update password",
  "password.saved": "Password updated.",
  "password.requiredCurrent": "Enter the current password.",
  "password.requiredNext": "Enter the new password.",
  "listener.section": "Listener",
  "listener.description": "Host and port the DSH gate listens on. Changes apply only after DSH restarts.",
  "listener.host": "Host",
  "listener.hostHint": "For example 0.0.0.0 or 127.0.0.1; at most 64 characters.",
  "listener.port": "Port",
  "listener.portHint": "Range 1\u201365535.",
  "listener.save": "Save listener",
  "listener.saved": "Listener settings saved.",
  "listener.restartRequired": "Listener settings saved; they apply after DSH restarts.",
  "listener.restartBadge": "Restart required",
  "sessions.section": "Active sessions",
  "sessions.description": "Sessions that are still signed in. Kicking one forces that device to sign in again.",
  "sessions.empty": "No active sessions.",
  "sessions.ip": "IP",
  "sessions.ua": "Browser",
  "sessions.lastSeen": "Last active",
  "sessions.signedIn": "Signed in {time}",
  "sessions.current": "This device",
  "sessions.kick": "Kick",
  "sessions.kicking": "Kicking\u2026",
  "sessions.kicked": "Session kicked.",
  "sessions.refresh": "Refresh",
  "signout.section": "Sign out everywhere",
  "signout.description": "Immediately invalidate every signed-in session, including this device.",
  "signout.action": "Sign out everywhere",
  "signout.confirm": "Sign out all devices? This page will need to sign in again.",
  "signout.done": "Signed out everywhere.",
  "signout.goLogin": "Go to sign-in page",
  "field.sessionDays": "Session lifetime",
  "field.maxAttempts": "Maximum failed attempts",
  "field.lockMinutes": "Lockout duration",
  "field.listenHost": "Listener host",
  "field.listenPort": "Listener port",
  "error.unauthorized": "Your session has expired. Sign in again.",
  "error.forbidden": "Request rejected (cross-site request or insufficient permission).",
  "error.invalid_body": "The request body is invalid.",
  "error.invalid_field": '"{field}" is invalid; check the allowed range.',
  "error.wrong_current": "The current password is incorrect.",
  "error.too_short": "The new password must be at least 6 characters.",
  "error.mismatch": "The new passwords do not match.",
  "error.not_found": "This endpoint does not exist; check the server version.",
  "error.method_not_allowed": "This endpoint does not support that request method.",
  "error.kick_missing": "That session no longer exists; the list may be stale.",
  "error.restart_required": "Restart DSH to apply this change.",
  "error.network": "Could not reach the server. Check the connection and retry.",
  "error.unknown": "The server returned an unrecognized response.",
  "error.generic": "Request failed: {error}"
};

// src/client/styles.ts
var GUARD_CSS = `
.wg-root{display:flex;flex-direction:column;gap:16px;padding:8px 0 24px;color:var(--dsw-alias-label-primary,#0f1115);font-size:14px;line-height:22px}
.wg-head{display:flex;flex-direction:column;gap:4px}
.wg-title{margin:0;font-size:16px;font-weight:500;line-height:24px}
.wg-lead{margin:0;color:var(--dsw-alias-label-secondary,#61666b);font-size:13px;line-height:20px}
.wg-card{box-sizing:border-box;border:.5px solid var(--dsw-alias-settings-card-stroke,rgba(15,17,21,.12));border-radius:12px;background:var(--dsw-alias-settings-card-fill,transparent);padding:16px}
.wg-cardTitle{margin:0 0 4px;font-size:14px;font-weight:500;line-height:22px}
.wg-cardHint{margin:0 0 12px;color:var(--dsw-alias-label-tertiary,#8b929c);font-size:12px;line-height:18px}
.wg-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.wg-gridTwo{grid-template-columns:repeat(2,minmax(0,1fr))}
.wg-field{display:flex;flex-direction:column;gap:6px;min-width:0;box-sizing:border-box}
.wg-label{color:var(--dsw-alias-label-secondary,#61666b);font-size:12px;line-height:18px}
.wg-hint{color:var(--dsw-alias-label-tertiary,#8b929c);font-size:11px;line-height:16px}
.wg-input{box-sizing:border-box;width:100%;height:34px;padding:0 10px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l2,rgba(15,17,21,.18));background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#0f1115);font:inherit;font-size:14px;line-height:32px}
.wg-input::placeholder{color:var(--dsw-alias-label-quaternary,#a8adb3)}
.wg-input:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:1px}
.wg-sectionHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.wg-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:8px;margin-top:12px}
.wg-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:0 14px;border-radius:8px;border:.5px solid var(--dsw-alias-border-l3,rgba(15,17,21,.22));background:transparent;color:var(--dsw-alias-label-primary,#0f1115);font:inherit;font-size:13px;line-height:20px;cursor:pointer;text-decoration:none;white-space:nowrap}
.wg-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(15,17,21,.06))}
.wg-btn:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4176e6);outline-offset:1px}
.wg-btn:disabled{opacity:.55;cursor:default}
.wg-btnPrimary{border-color:transparent;background:var(--dsw-alias-button-primary-fill,#4176e6);color:var(--dsw-alias-label-primary-foreground,#fff)}
.wg-btnPrimary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#2f63d4)}
.wg-btnDanger{border-color:transparent;background:transparent;color:var(--dsw-alias-state-error-primary,#c2402f)}
.wg-btnDanger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger,rgba(194,64,47,.08))}
.wg-notice{margin:10px 0 0;font-size:12px;line-height:18px}
.wg-noticeOk{color:var(--dsw-alias-state-success-primary,#1f7a46)}
.wg-noticeError{color:var(--dsw-alias-state-error-primary,#c2402f)}
.wg-badge{display:inline-block;margin-left:6px;padding:0 6px;border:.5px solid var(--dsw-alias-border-l3,rgba(15,17,21,.22));border-radius:999px;color:var(--dsw-alias-label-tertiary,#8b929c);font-size:11px;line-height:16px;white-space:nowrap}
.wg-tableWrap{overflow-x:auto;border:.5px solid var(--dsw-alias-border-l2,rgba(15,17,21,.12));border-radius:10px}
.wg-table{width:100%;min-width:520px;border-collapse:collapse;font-size:13px;line-height:20px}
.wg-table th{text-align:left;padding:8px 12px;color:var(--dsw-alias-label-tertiary,#8b929c);font-weight:400;font-size:12px;border-bottom:.5px solid var(--dsw-alias-border-l2,rgba(15,17,21,.12));white-space:nowrap}
.wg-table td{padding:9px 12px;vertical-align:middle;border-bottom:.5px solid var(--dsw-alias-border-l2,rgba(15,17,21,.12))}
.wg-table tr:last-child td{border-bottom:none}
.wg-cellIp{white-space:nowrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px}
.wg-cellUa{max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary,#61666b)}
.wg-cellTime{white-space:nowrap;color:var(--dsw-alias-label-secondary,#61666b);font-size:12px}
.wg-cellTimeDim{display:block;color:var(--dsw-alias-label-tertiary,#8b929c);font-size:11px;line-height:16px}
.wg-cellAction{text-align:right;white-space:nowrap}
.wg-empty{padding:16px 12px;color:var(--dsw-alias-label-tertiary,#8b929c);text-align:center}
.wg-inlineActions{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-top:12px}
.wg-link{color:var(--dsw-alias-link,#4176e6);text-decoration:none}
.wg-link:hover{text-decoration:underline}
@media (max-width:640px){
  .wg-root{gap:12px;padding-bottom:16px}
  .wg-grid,.wg-gridTwo{grid-template-columns:minmax(0,1fr)}
  .wg-card{padding:12px}
  .wg-actions{flex-direction:column;align-items:stretch}
  .wg-actions .wg-btn{width:100%}
  .wg-inlineActions{flex-direction:column;align-items:stretch}
}
`;
function installGuardStyles() {
  if (typeof document === "undefined" || document.head === null) return () => {
  };
  const tag = document.createElement("style");
  tag.setAttribute("data-dsh-web-guard", "");
  tag.textContent = GUARD_CSS;
  document.head.appendChild(tag);
  return () => tag.remove();
}
function removeFallbackEntry() {
  if (typeof document === "undefined" || document.body === null) return;
  const overlay = document.getElementById("dsh-web-guard-overlay");
  if (overlay !== null) {
    overlay.remove();
    if (document.body.style.overflow === "hidden") document.body.style.overflow = "";
  }
  document.getElementById("dsh-web-guard-fab")?.remove();
  for (const node of document.querySelectorAll("style[data-dsh-web-guard-fab-style]")) node.remove();
}

// src/client/module.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var LOCALE_NS = "webGuard";
var SECTION_ID = "web-guard";
var SECTION_ORDER = 500;
function GuardSectionIcon({ size, active }) {
  const edge = typeof size === "number" && Number.isFinite(size) && size > 0 ? Math.min(Math.max(size, 12), 32) : 18;
  const selected = active === true;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "svg",
    {
      width: edge,
      height: edge,
      viewBox: "0 0 24 24",
      role: "presentation",
      focusable: "false",
      "aria-hidden": "true",
      style: { display: "block", opacity: selected ? 1 : 0.78 },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "path",
          {
            d: "M12 2.8 4.6 5.9v5.3c0 4.6 3.1 8.3 7.4 9.9 4.3-1.6 7.4-5.3 7.4-9.9V5.9L12 2.8Z",
            fill: selected ? "currentColor" : "none",
            fillOpacity: selected ? 0.12 : 0,
            stroke: "currentColor",
            strokeWidth: "1.5",
            strokeLinejoin: "round"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "path",
          {
            d: "m8.9 11.7 2.2 2.2 4-4.3",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "1.5",
            strokeLinecap: "round",
            strokeLinejoin: "round"
          }
        )
      ]
    }
  );
}
var inject = ["slots", "locale"];
function apply(ctx) {
  try {
    const t = ctx.locale.bind(LOCALE_NS);
    ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), "web-guard: dictionaries");
    ctx.effect(
      () => ctx.slots.inject(
        "settings.section",
        () => ctx.slots.register(
          {
            name: "settings.section",
            id: SECTION_ID,
            order: SECTION_ORDER,
            label: () => t("settings.title"),
            locale: LOCALE_NS,
            inject: () => ({ t })
          },
          GuardSettings
        )
      ),
      "web-guard: settings section"
    );
    ctx.effect(
      () => ctx.slots.inject(
        "settings.section.icon",
        () => ctx.slots.register(
          {
            name: "settings.section.icon",
            id: SECTION_ID,
            order: SECTION_ORDER,
            label: () => t("settings.title"),
            locale: LOCALE_NS
          },
          GuardSectionIcon
        )
      ),
      "web-guard: settings icon"
    );
    ctx.effect(() => {
      removeFallbackEntry();
      return installGuardStyles();
    }, "web-guard: styles and fallback cleanup");
  } catch (error) {
    console.warn("[dsh-web-guard] client module failed to activate:", error);
  }
}

    return module.exports;
  },
});
