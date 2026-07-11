import { onRequest as handleData } from "./functions/api/data.js";
import { onRequestGet as startGoogleLogin } from "./functions/api/auth/google/start.js";
import { onRequestGet as finishGoogleLogin } from "./functions/api/auth/google/callback.js";
import { onRequestGet as handleSession } from "./functions/api/auth/session.js";
import { onRequestPost as handleLogout } from "./functions/api/auth/logout.js";

const apiRoutes = new Map([
  ["/api/data", { handler: handleData, methods: ["GET", "PUT"] }],
  ["/api/auth/google/start", { handler: startGoogleLogin, methods: ["GET"] }],
  ["/api/auth/google/callback", { handler: finishGoogleLogin, methods: ["GET"] }],
  ["/api/auth/session", { handler: handleSession, methods: ["GET"] }],
  ["/api/auth/logout", { handler: handleLogout, methods: ["POST"] }]
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = apiRoutes.get(url.pathname);
    if (route) {
      if (!route.methods.includes(request.method)) {
        return new Response(JSON.stringify({ error: "Metodo nao permitido." }), {
          status: 405,
          headers: {
            Allow: route.methods.join(", "),
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8"
          }
        });
      }
      return route.handler({ request, env });
    }
    if (!env.ASSETS) return new Response("Not found", { status: 404 });
    return env.ASSETS.fetch(request);
  }
};
