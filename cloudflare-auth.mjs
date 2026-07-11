const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;
export const SESSION_COOKIE_NAME = "__Host-gates_session";
export const OAUTH_COOKIE_NAME = "__Host-gates_oauth";

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";
const SESSION_KEY_PREFIX = "auth:session:";
const OAUTH_KEY_PREFIX = "auth:oauth:";
const USER_DATA_KEY_PREFIX = "financeiro:v2:user:";

export class AuthError extends Error {
  constructor(code, status = 400, message = code) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.status = status;
  }
}

function bytesToBinary(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return binary;
}

export function base64UrlEncode(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return btoa(bytesToBinary(bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function base64UrlDecode(value) {
  const normalized = String(value || "").replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(String(value)));
  return base64UrlEncode(new Uint8Array(digest));
}

export async function pkceChallenge(verifier) {
  return sha256(verifier);
}

export async function secureEqual(left, right) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(left || ""))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(right || "")))
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(leftBytes, rightBytes);
  }
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export function parseCookies(requestOrHeaders) {
  const headers = requestOrHeaders instanceof Headers
    ? requestOrHeaders
    : requestOrHeaders?.headers;
  const cookieHeader = headers?.get("Cookie") || "";
  const cookies = {};
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
}

export function cookieHeader(name, value, maxAge) {
  return [
    `${name}=${value}`,
    "Path=/",
    "Secure",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`
  ].join("; ");
}

export function clearCookieHeader(name) {
  return cookieHeader(name, "", 0);
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  });
  return new Response(JSON.stringify(body), { status, headers });
}

export function authErrorResponse(error, fallbackMessage = "Falha de autenticacao.") {
  const status = error instanceof AuthError ? error.status : 500;
  const code = error instanceof AuthError ? error.code : "AUTH_INTERNAL_ERROR";
  if (!(error instanceof AuthError)) {
    console.error(JSON.stringify({ message: "auth request failed", error: String(error) }));
  }
  return jsonResponse({ error: fallbackMessage, code }, status);
}

export function requireDataStore(env) {
  const store = env?.FINANCE_DATA;
  if (!store || typeof store.get !== "function" || typeof store.put !== "function" || typeof store.delete !== "function") {
    throw new AuthError("STORAGE_UNAVAILABLE", 503, "Data storage is not configured");
  }
  return store;
}

export function appOrigin(env) {
  const configured = String(env?.APP_ORIGIN || "").trim();
  if (!configured) throw new AuthError("AUTH_CONFIG_MISSING", 503, "APP_ORIGIN is not configured");
  let url;
  try {
    url = new URL(configured);
  } catch {
    throw new AuthError("AUTH_CONFIG_INVALID", 503, "APP_ORIGIN is invalid");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !local) {
    throw new AuthError("AUTH_CONFIG_INVALID", 503, "APP_ORIGIN must use HTTPS");
  }
  return url.origin;
}

export function googleConfig(env) {
  const clientId = String(env?.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = String(env?.GOOGLE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    throw new AuthError("AUTH_CONFIG_MISSING", 503, "Google OAuth is not configured");
  }
  const origin = appOrigin(env);
  return {
    clientId,
    clientSecret,
    origin,
    redirectUri: `${origin}/api/auth/google/callback`
  };
}

export function safeReturnTo(value, origin) {
  const candidate = String(value || "/").trim() || "/";
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/";
  try {
    const url = new URL(candidate, origin);
    if (url.origin !== origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function buildGoogleAuthorizationUrl({ clientId, redirectUri, state, nonce, challenge }) {
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    nonce,
    prompt: "select_account",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state
  }).toString();
  return url.toString();
}

export async function oauthStateKey(state) {
  return `${OAUTH_KEY_PREFIX}${await sha256(state)}`;
}

export async function sessionKey(token) {
  return `${SESSION_KEY_PREFIX}${await sha256(token)}`;
}

export async function userIdentityHash(sub) {
  return sha256(`google:${sub}`);
}

export async function userDataKey(sub) {
  return `${USER_DATA_KEY_PREFIX}${await userIdentityHash(sub)}`;
}

export async function saveOAuthState(env, state, value, now = Date.now()) {
  const store = requireDataStore(env);
  const key = await oauthStateKey(state);
  const record = {
    ...value,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + OAUTH_STATE_TTL_SECONDS * 1000).toISOString()
  };
  await store.put(key, JSON.stringify(record), {
    expirationTtl: OAUTH_STATE_TTL_SECONDS,
    metadata: { kind: "oauth-state" }
  });
  return record;
}

export async function consumeOAuthState(env, state, now = Date.now()) {
  const store = requireDataStore(env);
  const key = await oauthStateKey(state);
  const record = await store.get(key, "json");
  await store.delete(key);
  if (!record || typeof record !== "object") return null;
  const expiresAt = Date.parse(record.expiresAt || "");
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return record;
}

export async function createSession(env, user, now = Date.now()) {
  const store = requireDataStore(env);
  const token = randomToken(32);
  const csrfToken = randomToken(32);
  const key = await sessionKey(token);
  const record = {
    sub: String(user.sub || ""),
    email: String(user.email || ""),
    name: String(user.name || ""),
    picture: String(user.picture || ""),
    csrfToken,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_SECONDS * 1000).toISOString()
  };
  if (!record.sub || !record.email) throw new AuthError("GOOGLE_IDENTITY_INVALID", 401);
  await store.put(key, JSON.stringify(record), {
    expirationTtl: SESSION_TTL_SECONDS,
    metadata: { kind: "session" }
  });
  return { token, record };
}

export async function readSession(request, env, now = Date.now()) {
  const token = parseCookies(request)[SESSION_COOKIE_NAME] || "";
  if (!token) return null;
  const store = requireDataStore(env);
  const key = await sessionKey(token);
  const record = await store.get(key, "json");
  const expiresAt = Date.parse(record?.expiresAt || "");
  if (!record || typeof record !== "object" || !record.sub || !record.csrfToken || !Number.isFinite(expiresAt) || expiresAt <= now) {
    await store.delete(key);
    return null;
  }
  const identityHash = await userIdentityHash(record.sub);
  return {
    token,
    key,
    record,
    identityHash,
    dataKey: `${USER_DATA_KEY_PREFIX}${identityHash}`
  };
}

export async function deleteSession(env, session) {
  if (!session?.key) return;
  await requireDataStore(env).delete(session.key);
}

export function requestHasExpectedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return Boolean(origin && origin === appOrigin(env));
}

export async function requestHasValidCsrf(request, session) {
  const supplied = request.headers.get("X-CSRF-Token") || "";
  return Boolean(supplied && await secureEqual(supplied, session?.record?.csrfToken || ""));
}

function parseJwtPart(part) {
  try {
    return JSON.parse(decoder.decode(base64UrlDecode(part)));
  } catch {
    throw new AuthError("GOOGLE_ID_TOKEN_INVALID", 401);
  }
}

function validateGoogleClaims(payload, { clientId, nonce, now }) {
  const issuerValid = payload.iss === "https://accounts.google.com" || payload.iss === "accounts.google.com";
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const expiresAt = Number(payload.exp) * 1000;
  const issuedAt = Number(payload.iat) * 1000;
  const notBefore = payload.nbf === undefined ? null : Number(payload.nbf) * 1000;
  const clockSkew = 60_000;
  if (!issuerValid
    || !audiences.includes(clientId)
    || (payload.azp && payload.azp !== clientId)
    || !Number.isFinite(expiresAt)
    || expiresAt <= now - clockSkew
    || !Number.isFinite(issuedAt)
    || issuedAt > now + clockSkew
    || (notBefore !== null && (!Number.isFinite(notBefore) || notBefore > now + clockSkew))) {
    throw new AuthError("GOOGLE_ID_TOKEN_INVALID", 401);
  }
  if (!payload.nonce || payload.nonce !== nonce || !payload.sub || payload.email_verified !== true || !payload.email) {
    throw new AuthError("GOOGLE_IDENTITY_INVALID", 401);
  }
  return {
    sub: String(payload.sub),
    email: String(payload.email),
    name: String(payload.name || ""),
    picture: String(payload.picture || "")
  };
}

export async function verifyGoogleIdToken(idToken, options) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) throw new AuthError("GOOGLE_ID_TOKEN_INVALID", 401);
  const header = parseJwtPart(parts[0]);
  const payload = parseJwtPart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new AuthError("GOOGLE_ID_TOKEN_INVALID", 401);

  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(GOOGLE_JWKS_ENDPOINT, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new AuthError("GOOGLE_KEYS_UNAVAILABLE", 502);
  const jwks = await response.json();
  const jwk = Array.isArray(jwks?.keys)
    ? jwks.keys.find((item) => item.kid === header.kid && item.kty === "RSA")
    : null;
  if (!jwk) throw new AuthError("GOOGLE_ID_TOKEN_INVALID", 401);

  let publicKey;
  try {
    publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
  } catch {
    throw new AuthError("GOOGLE_ID_TOKEN_INVALID", 401);
  }
  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    base64UrlDecode(parts[2]),
    encoder.encode(`${parts[0]}.${parts[1]}`)
  );
  if (!validSignature) throw new AuthError("GOOGLE_ID_TOKEN_INVALID", 401);
  return validateGoogleClaims(payload, {
    clientId: options.clientId,
    nonce: options.nonce,
    now: options.now ?? Date.now()
  });
}

export async function exchangeGoogleCode(config, { code, verifier, fetchImpl = fetch }) {
  const response = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri
    }).toString()
  });
  if (!response.ok) throw new AuthError("GOOGLE_CODE_EXCHANGE_FAILED", 401);
  const payload = await response.json();
  if (!payload?.id_token) throw new AuthError("GOOGLE_ID_TOKEN_MISSING", 401);
  return payload.id_token;
}
