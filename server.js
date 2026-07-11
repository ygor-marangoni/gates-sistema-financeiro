"use strict";

const http = require("node:http");
const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");

const root = __dirname;
const dataPath = process.env.FINANCE_DATA_PATH
  ? path.resolve(process.env.FINANCE_DATA_PATH)
  : path.join(root, "data", "financeiro.json");
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, body, status = 200) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error("PAYLOAD_TOO_LARGE");
  }
  return JSON.parse(body);
}

async function handleData(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS"
    });
    response.end();
    return;
  }

  if (request.method === "GET") {
    try {
      const payload = JSON.parse(await fsp.readFile(dataPath, "utf8"));
      sendJson(response, payload);
    } catch (error) {
      sendJson(response, error.code === "ENOENT" ? {} : { error: "Erro ao ler os dados." }, error.code === "ENOENT" ? 200 : 500);
    }
    return;
  }

  if (request.method !== "PUT") {
    sendJson(response, { error: "Método não permitido." }, 405);
    return;
  }

  try {
    const payload = await readBody(request);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      sendJson(response, { error: "O payload financeiro precisa ser um objeto JSON." }, 400);
      return;
    }
    await fsp.mkdir(path.dirname(dataPath), { recursive: true });
    await fsp.writeFile(dataPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    sendJson(response, payload);
  } catch (error) {
    const status = error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    sendJson(response, { error: status === 413 ? "O arquivo financeiro excede o limite permitido." : "JSON inválido." }, status);
  }
}

async function serveStatic(request, response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(root, `.${requestedPath}`);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fsp.readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream"
    });
    response.end(file);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500);
    response.end(error.code === "ENOENT" ? "Not found" : "Internal server error");
  }
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (url.pathname === "/api/data") {
    handleData(request, response).catch(() => sendJson(response, { error: "Erro interno." }, 500));
    return;
  }
  serveStatic(request, response, url.pathname).catch(() => {
    response.writeHead(500);
    response.end("Internal server error");
  });
});

server.listen(port, () => {
  console.log(`Gates disponível em http://localhost:${port}`);
});
