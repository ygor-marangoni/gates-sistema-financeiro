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

function cookieFor(auth, session) {
  return `${auth.SESSION_COOKIE_NAME}=${session.token}`;
}

function dataRequest(auth, session, method = "GET", payload, headers = {}) {
  const requestHeaders = {
    Cookie: cookieFor(auth, session),
    ...headers
  };
  const init = { method, headers: requestHeaders };
  if (payload !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    init.body = JSON.stringify(payload);
  }
  return new Request(`${ORIGIN}/api/data`, init);
}

test("Pages Function exige uma sessao valida", async () => {
  const { onRequest } = await loadFunction("functions/api/data.js");
  const response = await onRequest({
    request: new Request(`${ORIGIN}/api/data`),
    env: { FINANCE_DATA: createKv(), APP_ORIGIN: ORIGIN }
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "AUTH_REQUIRED");
});

test("dados financeiros ficam isolados por sub e a chave legada nunca e lida", async () => {
  const auth = await import(authModuleUrl);
  const { onRequest } = await loadFunction("functions/api/data.js");
  const kv = createKv();
  const env = { FINANCE_DATA: kv, APP_ORIGIN: ORIGIN };
  kv.values.set("financeiro", JSON.stringify({ owner: "legacy" }));
  const alice = await auth.createSession(env, { sub: "google-alice", email: "alice@example.com" });
  const bob = await auth.createSession(env, { sub: "google-bob", email: "bob@example.com" });

  const emptyAlice = await onRequest({ request: dataRequest(auth, alice), env });
  assert.deepEqual(await emptyAlice.json(), {});

  const alicePayload = { version: 1, transactions: [{ id: "alice-1", amount: 10 }] };
  const aliceSaved = await onRequest({
    request: dataRequest(auth, alice, "PUT", alicePayload, {
      Origin: ORIGIN,
      "X-CSRF-Token": alice.record.csrfToken
    }),
    env
  });
  assert.equal(aliceSaved.status, 200);

  const bobBeforeSave = await onRequest({ request: dataRequest(auth, bob), env });
  assert.deepEqual(await bobBeforeSave.json(), {});
  const bobPayload = { version: 1, transactions: [{ id: "bob-1", amount: 25 }] };
  const bobSaved = await onRequest({
    request: dataRequest(auth, bob, "PUT", bobPayload, {
      Origin: ORIGIN,
      "X-CSRF-Token": bob.record.csrfToken
    }),
    env
  });
  assert.equal(bobSaved.status, 200);

  const aliceLoaded = await onRequest({ request: dataRequest(auth, alice), env });
  const bobLoaded = await onRequest({ request: dataRequest(auth, bob), env });
  assert.deepEqual(await aliceLoaded.json(), alicePayload);
  assert.deepEqual(await bobLoaded.json(), bobPayload);
  assert.deepEqual(JSON.parse(kv.values.get("financeiro")), { owner: "legacy" });
  assert.equal([...kv.values.keys()].filter((key) => key.startsWith("financeiro:v2:user:")).length, 2);
});

test("PUT financeiro rejeita Origin e CSRF invalidos", async () => {
  const auth = await import(authModuleUrl);
  const { onRequest } = await loadFunction("functions/api/data.js");
  const kv = createKv();
  const env = { FINANCE_DATA: kv, APP_ORIGIN: ORIGIN };
  const session = await auth.createSession(env, { sub: "google-user", email: "user@example.com" });
  const payload = { version: 1 };

  const wrongOrigin = await onRequest({
    request: dataRequest(auth, session, "PUT", payload, {
      Origin: "https://evil.example",
      "X-CSRF-Token": session.record.csrfToken
    }),
    env
  });
  assert.equal(wrongOrigin.status, 403);
  assert.equal((await wrongOrigin.json()).code, "ORIGIN_INVALID");

  const wrongCsrf = await onRequest({
    request: dataRequest(auth, session, "PUT", payload, {
      Origin: ORIGIN,
      "X-CSRF-Token": "invalid"
    }),
    env
  });
  assert.equal(wrongCsrf.status, 403);
  assert.equal((await wrongCsrf.json()).code, "CSRF_INVALID");
  assert.equal([...kv.values.keys()].some((key) => key.startsWith("financeiro:v2:user:")), false);
});
