"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

async function loadFunction() {
  const source = await fs.readFile(path.join(__dirname, "..", "functions", "api", "data.js"), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

function createKv() {
  const values = new Map();
  return {
    async get(key, type) {
      const value = values.get(key);
      return type === "json" && value ? JSON.parse(value) : value || null;
    },
    async put(key, value) {
      values.set(key, value);
    }
  };
}

test("Pages Function persiste e recupera o JSON financeiro", async () => {
  const { onRequest } = await loadFunction();
  const env = { FINANCE_DATA: createKv() };

  const empty = await onRequest({ request: new Request("https://gates.pages.dev/api/data"), env });
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), {});

  const payload = { version: 1, transactions: [{ id: "tx-1", amount: 10 }] };
  const saved = await onRequest({
    request: new Request("https://gates.pages.dev/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
    env
  });
  assert.equal(saved.status, 200);

  const loaded = await onRequest({ request: new Request("https://gates.pages.dev/api/data"), env });
  assert.deepEqual(await loaded.json(), payload);
});

test("Pages Function informa binding ausente", async () => {
  const { onRequest } = await loadFunction();
  const response = await onRequest({ request: new Request("https://gates.pages.dev/api/data"), env: {} });
  assert.equal(response.status, 503);
});
