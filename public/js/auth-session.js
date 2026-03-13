(function initAuthSession(global) {
  const STORAGE_KEY = "authSession";
  const SESSION_POLL_INTERVAL_MS = 15000;
  const WATCHED_STORAGE_KEYS = new Set([
    STORAGE_KEY,
    "token",
    "username",
    "mobile",
    "role",
    "isAdmin",
    "isLoggedIn",
    "userId",
  ]);

  let pollTimer = null;
  let pollInFlight = false;

  function normalizeRole(value) {
    const role = String(value || "user").trim().toLowerCase();
    return role === "admin" ? "admin" : "user";
  }

  function normalizeUserId(value) {
    const parsed = Number.parseInt(String(value || ""), 10);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
  }

  function normalizeSession(raw) {
    if (!raw || typeof raw !== "object") return null;
    if (!raw.token || !raw.username) return null;

    const normalizedUserId = normalizeUserId(raw.userId);

    return {
      token: String(raw.token),
      username: String(raw.username),
      mobile: raw.mobile ? String(raw.mobile) : "",
      loggedInAt: raw.loggedInAt ? String(raw.loggedInAt) : new Date().toISOString(),
      role: normalizeRole(raw.role),
      userId: normalizedUserId,
    };
  }

  function sessionsEqual(a, b) {
    if (!a || !b) return false;
    return (
      a.token === b.token &&
      a.username === b.username &&
      a.mobile === b.mobile &&
      a.role === b.role &&
      a.userId === b.userId &&
      a.loggedInAt === b.loggedInAt
    );
  }

  function readSessionFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalizeSession(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }

  function readLegacySession() {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    if (!token || !username) return null;

    return normalizeSession({
      token,
      username,
      mobile: localStorage.getItem("mobile") || "",
      loggedInAt: "",
      userId: localStorage.getItem("userId") || "",
      role:
        localStorage.getItem("role") ||
        (localStorage.getItem("isAdmin") === "true" ? "admin" : "user"),
    });
  }

  function writeLegacySession(session) {
    if (!session) return;
    localStorage.setItem("token", session.token);
    localStorage.setItem("username", session.username);
    localStorage.setItem("mobile", session.mobile || "");
    localStorage.setItem("role", session.role || "user");
    localStorage.setItem("isAdmin", session.role === "admin" ? "true" : "false");
    localStorage.setItem("isLoggedIn", "true");

    if (session.userId) {
      localStorage.setItem("userId", String(session.userId));
    } else {
      localStorage.removeItem("userId");
    }
  }

  function clearLegacySession() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("mobile");
    localStorage.removeItem("role");
    localStorage.removeItem("isAdmin");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userId");
  }

  function dispatchAuthChanged() {
    global.dispatchEvent(new CustomEvent("auth:changed", { detail: get() }));
  }

  function get() {
    return readSessionFromStorage() || readLegacySession();
  }

  function persistSession(session, shouldDispatch) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    writeLegacySession(session);
    if (shouldDispatch) {
      dispatchAuthChanged();
    }
  }

  function set(session) {
    const normalized = normalizeSession(session);
    if (!normalized) {
      clear();
      return;
    }

    const existing = get();
    if (existing && sessionsEqual(existing, normalized)) {
      return;
    }

    persistSession(normalized, true);
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    clearLegacySession();
    dispatchAuthChanged();
  }

  function isLoggedIn() {
    return Boolean(get());
  }

  function isLoginPage() {
    const path = String(global.location?.pathname || "").trim().toLowerCase();
    return path === "/login.html" || path === "/login";
  }

  function isAdminPage() {
    const path = String(global.location?.pathname || "").trim().toLowerCase();
    return path.startsWith("/admin");
  }

  function stopSessionPoll() {
    if (!pollTimer) return;
    global.clearInterval(pollTimer);
    pollTimer = null;
  }

  function notifyServerLogout() {
    return fetch("/api/auth/logout", {
      method: "POST",
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  }

  function forceLogout(reason) {
    stopSessionPoll();
    notifyServerLogout();
    clear();

    if (isLoginPage()) {
      return;
    }

    const destination = reason
      ? `/login.html?reason=${encodeURIComponent(reason)}`
      : "/login.html";
    global.location.replace(destination);
  }

  async function validateSessionWithServer() {
    const session = get();
    if (!session) return { valid: false, reason: "not_logged_in" };

    const headers = {};
    if (session.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }

    try {
      const response = await fetch("/api/auth/session", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers,
      });

      if (response.status === 401 || response.status === 403) {
        return { valid: false, reason: "session_expired" };
      }

      if (!response.ok) {
        return { valid: null, reason: "temporary_error" };
      }

      const payload = await response.json().catch(() => ({}));
      const user = payload.user || {};
      const merged = normalizeSession({
        ...session,
        username: user.username || session.username,
        mobile: user.mobile || session.mobile,
        role: user.role || session.role,
        userId: user.id || session.userId,
      });

      if (merged && !sessionsEqual(session, merged)) {
        persistSession(merged, true);
      }

      return { valid: true, role: merged?.role || session.role };
    } catch {
      return { valid: null, reason: "network_error" };
    }
  }

  async function checkNow() {
    const session = get();
    if (!session) {
      stopSessionPoll();
      return;
    }

    if (pollInFlight) return;
    pollInFlight = true;

    try {
      const result = await validateSessionWithServer();

      if (result.valid === false) {
        forceLogout(result.reason || "session_expired");
        return;
      }

      const latest = get();
      if (latest && isAdminPage() && normalizeRole(latest.role) !== "admin") {
        forceLogout("admin_access_removed");
      }
    } finally {
      pollInFlight = false;
    }
  }

  function ensureSessionPoll() {
    if (!isLoggedIn()) {
      stopSessionPoll();
      return;
    }

    if (!pollTimer) {
      pollTimer = global.setInterval(checkNow, SESSION_POLL_INTERVAL_MS);
    }

    void checkNow();
  }

  function mount() {
    ensureSessionPoll();

    global.addEventListener("auth:changed", ensureSessionPoll);
    global.addEventListener("focus", () => {
      if (isLoggedIn()) {
        void checkNow();
      }
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && isLoggedIn()) {
        void checkNow();
      }
    });

    global.addEventListener("storage", (event) => {
      const key = String(event.key || "");
      if (key === "" || WATCHED_STORAGE_KEYS.has(key)) {
        ensureSessionPoll();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  global.AuthSession = Object.freeze({
    storageKey: STORAGE_KEY,
    get,
    set,
    clear,
    isLoggedIn,
    checkNow,
  });
})(window);
