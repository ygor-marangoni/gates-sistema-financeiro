"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = fs.promises;
const path = require("node:path");

const root = __dirname;
const dataPath = process.env.FINANCE_DATA_PATH
  ? path.resolve(process.env.FINANCE_DATA_PATH)
  : path.join(root, "data", "financeiro.json");
const port = Number(process.env.PORT || 4173);
const host = "127.0.0.1";
const sessionCookieName = "gates_local_session";
const sessionToken = crypto.randomBytes(32).toString("base64url");
const csrfToken = crypto.randomBytes(32).toString("base64url");
const localUser = Object.freeze({
  id: "local-user",
  name: "Usuário local",
  email: "local@gates.local",
  local: true
});

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, body, status = 200, extraHeaders = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  });
  response.end(JSON.stringify(body));
}

function parseCookies(request) {
  return String(request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf("=");
      if (separator < 1) return cookies;
      cookies[part.slice(0, separator)] = part.slice(separator + 1);
      return cookies;
    }, {});
}

function safeTokenEqual(value, expected) {
  const actualBuffer = Buffer.from(String(value || ""));
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function hasLocalSession(request) {
  return safeTokenEqual(parseCookies(request)[sessionCookieName], sessionToken);
}

function sessionCookie() {
  return `${sessionCookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`;
}

function clearSessionCookie() {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

function sameOrigin(request) {
  const origin = request.headers.origin;
  const requestHost = request.headers.host;
  if (!origin || !requestHost) return false;
  try {
    return new URL(origin).origin === new URL(`http://${requestHost}`).origin;
  } catch {
    return false;
  }
}

function authorizeMutation(request, response, { requireJson = false } = {}) {
  if (!hasLocalSession(request)) {
    sendJson(response, { error: "Sessão local necessária." }, 401);
    return false;
  }
  if (!sameOrigin(request)) {
    sendJson(response, { error: "Origem não permitida." }, 403);
    return false;
  }
  if (!safeTokenEqual(request.headers["x-csrf-token"], csrfToken)) {
    sendJson(response, { error: "Token CSRF inválido." }, 403);
    return false;
  }
  if (requireJson && !String(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    sendJson(response, { error: "O conteúdo precisa ser JSON." }, 415);
    return false;
  }
  return true;
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
    response.writeHead(204, { "Cache-Control": "no-store" });
    response.end();
    return;
  }

  if (!hasLocalSession(request)) {
    sendJson(response, { error: "Sessão local necessária." }, 401);
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

  if (!authorizeMutation(request, response, { requireJson: true })) return;

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

function handleAuthSession(request, response) {
  if (request.method !== "GET") {
    sendJson(response, { error: "Método não permitido." }, 405);
    return;
  }
  sendJson(response, {
    authenticated: true,
    user: localUser,
    csrfToken
  }, 200, { "Set-Cookie": sessionCookie() });
}

function handleAuthLogout(request, response) {
  if (request.method !== "POST") {
    sendJson(response, { error: "Método não permitido." }, 405);
    return;
  }
  if (!authorizeMutation(request, response)) return;
  response.writeHead(204, {
    "Cache-Control": "no-store",
    "Set-Cookie": clearSessionCookie()
  });
  response.end();
}

function handleGoogleStart(request, response) {
  if (request.method !== "GET") {
    sendJson(response, { error: "Método não permitido." }, 405);
    return;
  }
  response.writeHead(302, {
    "Cache-Control": "no-store",
    Location: "/"
  });
  response.end();
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
  if (url.pathname === "/api/auth/session") {
    handleAuthSession(request, response);
    return;
  }
  if (url.pathname === "/api/auth/logout") {
    handleAuthLogout(request, response);
    return;
  }
  if (url.pathname === "/api/auth/google/start") {
    handleGoogleStart(request, response);
    return;
  }
  if (url.pathname === "/api/data") {
    handleData(request, response).catch(() => sendJson(response, { error: "Erro interno." }, 500));
    return;
  }
  serveStatic(request, response, url.pathname).catch(() => {
    response.writeHead(500);
    response.end("Internal server error");
  });
});

server.listen(port, host, () => {
  console.log(`Gates disponível em http://${host}:${port}`);
});
