"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ORIGIN = "https://gates-financas.pages.dev";
const root = path.join(__dirname, "..");
const authModuleUrl = pathToFileURL(path.join(root, "cloudflare-auth.mjs")).href;

async function loadFunction(relativePath) {
  const source = await fs.readFile(path.join(root, relativePath), "utf8");
  const importable = source.replace(
    /from "(?:\.\.\/)+cloudflare-auth\.mjs"/gu,
    `from "${authModuleUrl}"`
  );
  return import(`data:text/javascript;base64,${Buffer.from(importable).toString("base64")}`);
}

function createKv() {
  const values = new Map();
  const options = new Map();
  return {
    values,
    options,
    async get(key, type) {
      if (!values.has(key)) return null;
      const value = values.get(key);
      return type === "json" ? JSON.parse(value) : value;
    },
    async put(key, value, putOptions = {}) {
      values.set(key, value);
      options.set(key, putOptions);
    },
    async delete(key) {
      values.delete(key);
      options.delete(key);
    }
  };
}

function jsonBytes(value) {
  return new TextEncoder().encode(JSON.stringify(value));
}

async function googleTokenFixture(auth, { clientId, nonce, now = Date.now() }) {
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256"
    },
    true,
    ["sign", "verify"]
  );
  const kid = "google-test-key";
  const publicJwk = await crypto.subtle.exportKey("jwk", keys.publicKey);
  Object.assign(publicJwk, { alg: "RS256", kid, use: "sig" });
  const header = auth.base64UrlEncode(jsonBytes({ alg: "RS256", kid, typ: "JWT" }));
  const payload = auth.base64UrlEncode(jsonBytes({
    iss: "https://accounts.google.com",
    aud: clientId,
    sub: "google-sub-123",
    email: "user@example.com",
    email_verified: true,
    name: "Gates User",
    nonce,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + 3600
  }));
  const signingInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    keys.privateKey,
    new TextEncoder().encode(signingInput)
  );
  return {
    idToken: `${signingInput}.${auth.base64UrlEncode(signature)}`,
    publicJwk
  };
}

test("inicio do OAuth cria state de 10 minutos e PKCE S256", async () => {
  const auth = await import(authModuleUrl);
  const { onRequestGet } = await loadFunction("functions/api/auth/google/start.js");
  const kv = createKv();
  const env = {
    FINANCE_DATA: kv,
    APP_ORIGIN: ORIGIN,
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "server-only-secret"
  };
  const response = await onRequestGet({
    request: new Request(`${ORIGIN}/api/auth/google/start?returnTo=%2Fmetas`),
    env
  });
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("Location"));
  assert.equal(location.origin, "https://accounts.google.com");
  assert.equal(location.searchParams.get("client_id"), "client-id");
  assert.equal(location.searchParams.get("code_challenge_method"), "S256");
  assert.ok(location.searchParams.get("code_challenge"));
  assert.ok(location.searchParams.get("nonce"));
  assert.match(response.headers.get("Set-Cookie"), /__Host-gates_oauth=.*Max-Age=600/u);
  const oauthKey = [...kv.values.keys()].find((key) => key.startsWith("auth:oauth:"));
  assert.ok(oauthKey);
  assert.equal(kv.options.get(oauthKey).expirationTtl, auth.OAUTH_STATE_TTL_SECONDS);
  const stored = JSON.parse(kv.values.get(oauthKey));
  assert.equal(stored.returnTo, "/metas");
  assert.ok(stored.verifier.length >= 43);
});

test("falha ao iniciar OAuth retorna para a aplicacao e limpa o state", async () => {
  const auth = await import(authModuleUrl);
  const { onRequestGet } = await loadFunction("functions/api/auth/google/start.js");
  const response = await onRequestGet({
    request: new Request(`${ORIGIN}/api/auth/google/start`),
    env: {
      FINANCE_DATA: createKv(),
      APP_ORIGIN: ORIGIN,
      GOOGLE_CLIENT_ID: "client-id"
    }
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), `${ORIGIN}/?auth_error=configuration`);
  assert.match(response.headers.get("Set-Cookie"), /__Host-gates_oauth=;.*Max-Age=0/u);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("ID token Google exige assinatura, audience e nonce validos", async () => {
  const auth = await import(authModuleUrl);
  const clientId = "client-id";
  const nonce = "nonce-123";
  const fixture = await googleTokenFixture(auth, { clientId, nonce });
  const fetchImpl = async () => new Response(JSON.stringify({ keys: [fixture.publicJwk] }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
  const identity = await auth.verifyGoogleIdToken(fixture.idToken, { clientId, nonce, fetchImpl });
  assert.deepEqual(identity, {
    sub: "google-sub-123",
    email: "user@example.com",
    name: "Gates User",
    picture: ""
  });
  await assert.rejects(
    auth.verifyGoogleIdToken(fixture.idToken, { clientId, nonce: "wrong", fetchImpl }),
    (error) => error.code === "GOOGLE_IDENTITY_INVALID"
  );
});

test("callback cria sessao opaca de 30 dias e usa o verifier PKCE", async () => {
  const auth = await import(authModuleUrl);
  const { onRequestGet } = await loadFunction("functions/api/auth/google/callback.js");
  const kv = createKv();
  const clientId = "client-id";
  const clientSecret = "server-only-secret";
  const env = {
    FINANCE_DATA: kv,
    APP_ORIGIN: ORIGIN,
    GOOGLE_CLIENT_ID: clientId,
    GOOGLE_CLIENT_SECRET: clientSecret
  };
  const state = auth.randomToken(32);
  const nonce = auth.randomToken(32);
  const verifier = auth.randomToken(48);
  await auth.saveOAuthState(env, state, {
    nonce,
    origin: ORIGIN,
    redirectUri: `${ORIGIN}/api/auth/google/callback`,
    returnTo: "/metas",
    verifier
  });
  const fixture = await googleTokenFixture(auth, { clientId, nonce });
  const originalFetch = globalThis.fetch;
  let tokenRequestBody = "";
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") {
      tokenRequestBody = String(init.body || "");
      return new Response(JSON.stringify({ id_token: fixture.idToken }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (url === "https://www.googleapis.com/oauth2/v3/certs") {
      return new Response(JSON.stringify({ keys: [fixture.publicJwk] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const response = await onRequestGet({
      request: new Request(`${ORIGIN}/api/auth/google/callback?state=${encodeURIComponent(state)}&code=code-123`, {
        headers: { Cookie: `${auth.OAUTH_COOKIE_NAME}=${state}` }
      }),
      env
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("Location"), `${ORIGIN}/metas`);
    assert.match(response.headers.get("Set-Cookie"), /__Host-gates_session=.*Max-Age=2592000/u);
    assert.equal(new URLSearchParams(tokenRequestBody).get("code_verifier"), verifier);
    assert.equal([...kv.values.keys()].some((key) => key.startsWith("auth:oauth:")), false);
    const sessionKey = [...kv.values.keys()].find((key) => key.startsWith("auth:session:"));
    assert.ok(sessionKey);
    assert.equal(kv.options.get(sessionKey).expirationTtl, auth.SESSION_TTL_SECONDS);
    assert.equal(JSON.parse(kv.values.get(sessionKey)).sub, "google-sub-123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("erros do callback limpam state e redirecionam com categoria segura", async () => {
  const auth = await import(authModuleUrl);
  const { onRequestGet } = await loadFunction("functions/api/auth/google/callback.js");
  const env = {
    FINANCE_DATA: createKv(),
    APP_ORIGIN: ORIGIN,
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "server-only-secret"
  };
  const invalid = await onRequestGet({
    request: new Request(`${ORIGIN}/api/auth/google/callback?state=invalid&code=code`, {
      headers: { Cookie: `${auth.OAUTH_COOKIE_NAME}=different` }
    }),
    env
  });
  assert.equal(invalid.status, 302);
  assert.equal(invalid.headers.get("Location"), `${ORIGIN}/?auth_error=invalid_callback`);
  assert.match(invalid.headers.get("Set-Cookie"), /__Host-gates_oauth=;.*Max-Age=0/u);

  const state = auth.randomToken(32);
  await auth.saveOAuthState(env, state, {
    nonce: auth.randomToken(32),
    origin: ORIGIN,
    redirectUri: `${ORIGIN}/api/auth/google/callback`,
    returnTo: "/",
    verifier: auth.randomToken(48)
  });
  const denied = await onRequestGet({
    request: new Request(`${ORIGIN}/api/auth/google/callback?state=${state}&error=access_denied`, {
      headers: { Cookie: `${auth.OAUTH_COOKIE_NAME}=${state}` }
    }),
    env
  });
  assert.equal(denied.status, 302);
  assert.equal(denied.headers.get("Location"), `${ORIGIN}/?auth_error=access_denied`);

  const exchangeState = auth.randomToken(32);
  await auth.saveOAuthState(env, exchangeState, {
    nonce: auth.randomToken(32),
    origin: ORIGIN,
    redirectUri: `${ORIGIN}/api/auth/google/callback`,
    returnTo: "/",
    verifier: auth.randomToken(48)
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "invalid_grant" }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
  try {
    const exchangeFailed = await onRequestGet({
      request: new Request(`${ORIGIN}/api/auth/google/callback?state=${exchangeState}&code=invalid`, {
        headers: { Cookie: `${auth.OAUTH_COOKIE_NAME}=${exchangeState}` }
      }),
      env
    });
    assert.equal(exchangeFailed.status, 302);
    assert.equal(exchangeFailed.headers.get("Location"), `${ORIGIN}/?auth_error=token_exchange`);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const configurationFailed = await onRequestGet({
    request: new Request(`${ORIGIN}/api/auth/google/callback`),
    env: { FINANCE_DATA: createKv(), APP_ORIGIN: ORIGIN, GOOGLE_CLIENT_ID: "client-id" }
  });
  assert.equal(configurationFailed.status, 302);
  assert.equal(configurationFailed.headers.get("Location"), `${ORIGIN}/?auth_error=configuration`);
});

test("session endpoint nao expoe sub e logout revoga a sessao", async () => {
  const auth = await import(authModuleUrl);
  const { onRequestGet } = await loadFunction("functions/api/auth/session.js");
  const { onRequestPost } = await loadFunction("functions/api/auth/logout.js");
  const kv = createKv();
  const env = { FINANCE_DATA: kv, APP_ORIGIN: ORIGIN };
  const session = await auth.createSession(env, {
    sub: "private-google-sub",
    email: "user@example.com",
    name: "User"
  });
  const cookie = `${auth.SESSION_COOKIE_NAME}=${session.token}`;
  const status = await onRequestGet({
    request: new Request(`${ORIGIN}/api/auth/session`, { headers: { Cookie: cookie } }),
    env
  });
  assert.equal(status.status, 200);
  const payload = await status.json();
  assert.equal(payload.authenticated, true);
  assert.equal(payload.user.email, "user@example.com");
  assert.equal(JSON.stringify(payload).includes("private-google-sub"), false);

  const logout = await onRequestPost({
    request: new Request(`${ORIGIN}/api/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: ORIGIN,
        "X-CSRF-Token": session.record.csrfToken
      }
    }),
    env
  });
  assert.equal(logout.status, 200);
  assert.equal([...kv.values.keys()].some((key) => key.startsWith("auth:session:")), false);
  assert.match(logout.headers.get("Set-Cookie"), /__Host-gates_session=;.*Max-Age=0/u);
});
