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
      if (!String(chunk).includes("http://localhost")) return;
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

  const put = await fetch(`http://127.0.0.1:${port}/api/data`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  assert.equal(put.status, 200);

  const get = await fetch(`http://127.0.0.1:${port}/api/data`);
  assert.deepEqual(await get.json(), payload);
  assert.deepEqual(JSON.parse(await fs.readFile(dataPath, "utf8")), payload);
});
