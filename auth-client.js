(function attachGatesAuth(root) {
  "use strict";

  const SESSION_URL = "/api/auth/session";
  const LOGIN_URL = "/api/auth/google/start";
  const LOGOUT_URL = "/api/auth/logout";
  let currentSession = null;

  function authError(message, status = 0) {
    const error = new Error(message);
    error.status = status;
    return error;
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  async function getSession() {
    let response;
    try {
      response = await fetch(SESSION_URL, {
        cache: "no-store",
        credentials: "same-origin"
      });
    } catch {
      throw authError("SESSION_UNAVAILABLE");
    }

    if (response.status === 401) {
      currentSession = null;
      return null;
    }
    if (!response.ok) throw authError("SESSION_UNAVAILABLE", response.status);

    const payload = await readJson(response);
    if (!payload?.authenticated || !payload?.user?.id || !payload?.csrfToken) {
      throw authError("SESSION_INVALID", response.status);
    }
    currentSession = payload;
    return payload;
  }

  function login() {
    window.location.assign(LOGIN_URL);
  }

  async function logout() {
    if (!currentSession?.csrfToken) {
      currentSession = null;
      return;
    }
    const response = await fetch(LOGOUT_URL, {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-CSRF-Token": currentSession.csrfToken }
    });
    if (!response.ok && response.status !== 401) {
      throw authError("LOGOUT_FAILED", response.status);
    }
    currentSession = null;
  }

  function csrfToken() {
    return currentSession?.csrfToken || "";
  }

  function expire() {
    currentSession = null;
  }

  root.GatesAuth = {
    csrfToken,
    expire,
    getSession,
    login,
    logout
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
