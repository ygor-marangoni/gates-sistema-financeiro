const DATA_KEY = "financeiro";
const MAX_PAYLOAD_SIZE = 1_000_000;

const responseHeaders = {
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

export async function onRequest({ request, env }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: responseHeaders });
  }

  if (!env.FINANCE_DATA) {
    return jsonResponse({ error: "Armazenamento financeiro nao configurado." }, 503);
  }

  if (request.method === "GET") {
    const payload = await env.FINANCE_DATA.get(DATA_KEY, "json");
    return payload
      ? jsonResponse(payload)
      : jsonResponse({});
  }

  if (request.method !== "PUT") {
    return jsonResponse({ error: "Metodo nao permitido." }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "JSON invalido." }, 400);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonResponse({ error: "O payload financeiro precisa ser um objeto JSON." }, 400);
  }

  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_PAYLOAD_SIZE) {
    return jsonResponse({ error: "O arquivo financeiro excede o limite permitido." }, 413);
  }

  await env.FINANCE_DATA.put(DATA_KEY, serialized, {
    metadata: { updatedAt: new Date().toISOString() }
  });
  return jsonResponse(payload);
}
