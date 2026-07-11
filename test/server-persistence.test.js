"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Servidor local não iniciou a tempo.")), 8000);
    child.stdout.on("data", (chunk) => {
      if (!String(chunk).includes("http://127.0.0.1")) return;
      clearTimeout(timeout);
      resolve();
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== null && code !== 0) reject(new Error(`Servidor encerrou com código ${code}.`));
    });
  });
}

test("API local grava e recupera o estado no JSON configurado", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "gates-data-"));
  const dataPath = path.join(directory, "financeiro.json");
  const port = 43000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, PORT: String(port), FINANCE_DATA_PATH: dataPath },
    stdio: ["ignore", "pipe", "pipe"]
  });
  context.after(async () => {
    child.kill();
    await fs.rm(directory, { recursive: true, force: true });
  });

  await waitForServer(child);
  const baseUrl = `http://127.0.0.1:${port}`;
  const unauthenticated = await fetch(`${baseUrl}/api/data`);
  assert.equal(unauthenticated.status, 401);

  const sessionResponse = await fetch(`${baseUrl}/api/auth/session`);
  assert.equal(sessionResponse.status, 200);
  const session = await sessionResponse.json();
  const cookie = sessionResponse.headers.get("set-cookie")?.split(";", 1)[0];
  assert.equal(session.authenticated, true);
  assert.equal(session.user.id, "local-user");
  assert.equal(typeof session.csrfToken, "string");
  assert.ok(session.csrfToken.length >= 32);
  assert.ok(cookie?.startsWith("gates_local_session="));
  assert.match(sessionResponse.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(sessionResponse.headers.get("set-cookie"), /SameSite=Strict/i);

  const payload = {
    version: 1,
    accounts: ["Conta de teste"],
    categories: { income: [], expense: [] },
    transactions: [{
      id: "pdf-1",
      type: "expense",
      description: "Importado do PDF",
      amount: 42.5,
      date: "2026-07-11",
      category: "",
      account: "Conta de teste",
      recurring: false,
      notes: "Importado de teste.pdf"
    }]
  };

  const withoutSession = await fetch(`${baseUrl}/api/data`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      "X-CSRF-Token": session.csrfToken
    },
    body: JSON.stringify(payload)
  });
  assert.equal(withoutSession.status, 401);

  const externalOrigin = await fetch(`${baseUrl}/api/data`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: "https://example.invalid",
      "X-CSRF-Token": session.csrfToken
    },
    body: JSON.stringify(payload)
  });
  assert.equal(externalOrigin.status, 403);

  const missingCsrf = await fetch(`${baseUrl}/api/data`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: baseUrl
    },
    body: JSON.stringify(payload)
  });
  assert.equal(missingCsrf.status, 403);

  const put = await fetch(`${baseUrl}/api/data`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: baseUrl,
      "X-CSRF-Token": session.csrfToken
    },
    body: JSON.stringify(payload)
  });
  assert.equal(put.status, 200);

  const get = await fetch(`${baseUrl}/api/data`, { headers: { Cookie: cookie } });
  assert.deepEqual(await get.json(), payload);
  assert.deepEqual(JSON.parse(await fs.readFile(dataPath, "utf8")), payload);

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: baseUrl,
      "X-CSRF-Token": session.csrfToken
    }
  });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("set-cookie"), /gates_local_session=;.*Max-Age=0/i);

  const googleStart = await fetch(`${baseUrl}/api/auth/google/start`, { redirect: "manual" });
  assert.equal(googleStart.status, 302);
  assert.equal(googleStart.headers.get("location"), "/");
});
