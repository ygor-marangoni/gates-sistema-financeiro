"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
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

test("servidor local entrega o app estático sem API de usuário", async (context) => {
  const port = 43000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  context.after(() => child.kill());

  await waitForServer(child);
  const baseUrl = `http://127.0.0.1:${port}`;
  const home = await fetch(`${baseUrl}/`);
  assert.equal(home.status, 200);
  assert.match(await home.text(), /<title>Gates - Finanças<\/title>/u);

  const dataApi = await fetch(`${baseUrl}/api/data`);
  assert.equal(dataApi.status, 404);
});
