import {
  SESSION_COOKIE_NAME,
  AuthError,
  authErrorResponse,
  clearCookieHeader,
  jsonResponse,
  readSession,
  requestHasExpectedOrigin,
  requestHasValidCsrf,
  requireDataStore
} from "../../cloudflare-auth.mjs";

const MAX_PAYLOAD_SIZE = 1_000_000;
const decoder = new TextDecoder();
const encoder = new TextEncoder();

async function readJsonWithinLimit(request) {
  const declaredSize = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_PAYLOAD_SIZE) {
    throw new AuthError("PAYLOAD_TOO_LARGE", 413);
  }
  if (!request.body) throw new AuthError("JSON_INVALID", 400);

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PAYLOAD_SIZE) {
        await reader.cancel();
        throw new AuthError("PAYLOAD_TOO_LARGE", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(decoder.decode(bytes));
  } catch {
    throw new AuthError("JSON_INVALID", 400);
  }
}

function unauthenticatedResponse() {
  const response = jsonResponse({ error: "Autenticacao necessaria.", code: "AUTH_REQUIRED" }, 401);
  response.headers.append("Set-Cookie", clearCookieHeader(SESSION_COOKIE_NAME));
  return response;
}

export async function onRequest({ request, env }) {
  try {
    if (request.method !== "GET" && request.method !== "PUT") {
      return jsonResponse({ error: "Metodo nao permitido." }, 405, { Allow: "GET, PUT" });
    }

    const session = await readSession(request, env);
    if (!session) return unauthenticatedResponse();
    const store = requireDataStore(env);

    if (request.method === "GET") {
      const payload = await store.get(session.dataKey, "json");
      return jsonResponse(payload && typeof payload === "object" ? payload : {});
    }

    if (!requestHasExpectedOrigin(request, env)) throw new AuthError("ORIGIN_INVALID", 403);
    if (!await requestHasValidCsrf(request, session)) throw new AuthError("CSRF_INVALID", 403);
    const contentType = request.headers.get("Content-Type") || "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      throw new AuthError("CONTENT_TYPE_INVALID", 415);
    }

    const payload = await readJsonWithinLimit(request);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new AuthError("PAYLOAD_INVALID", 400);
    }
    const serialized = JSON.stringify(payload);
    if (encoder.encode(serialized).byteLength > MAX_PAYLOAD_SIZE) {
      throw new AuthError("PAYLOAD_TOO_LARGE", 413);
    }

    await store.put(session.dataKey, serialized, {
      metadata: { updatedAt: new Date().toISOString() }
    });
    return jsonResponse(payload);
  } catch (error) {
    return authErrorResponse(error, "Nao foi possivel acessar os dados financeiros.");
  }
}
