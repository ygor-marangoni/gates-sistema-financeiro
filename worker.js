const DATA_KEY = "financeiro";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Cache-Control": "no-store"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

async function handleData(request, env) {
  if (!env.FINANCE_DATA) {
    return jsonResponse({ error: "Armazenamento financeiro não configurado." }, 503);
  }

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (request.method === "GET") {
    const payload = await env.FINANCE_DATA.get(DATA_KEY, "json");
    return payload ? jsonResponse(payload) : jsonResponse({});
  }

  if (request.method !== "PUT") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "JSON inválido." }, 400);
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return jsonResponse({ error: "O payload financeiro precisa ser um objeto JSON." }, 400);
  }

  const serialized = JSON.stringify(payload);
  if (serialized.length > 1_000_000) {
    return jsonResponse({ error: "O arquivo financeiro excede o limite permitido." }, 413);
  }

  await env.FINANCE_DATA.put(DATA_KEY, serialized, {
    metadata: { updatedAt: new Date().toISOString() }
  });
  return jsonResponse(payload);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/data") return handleData(request, env);
    return env.ASSETS.fetch(request);
  }
};
