import {
  SESSION_COOKIE_NAME,
  authErrorResponse,
  clearCookieHeader,
  jsonResponse,
  readSession
} from "../../../cloudflare-auth.mjs";

export async function onRequestGet({ request, env }) {
  try {
    const session = await readSession(request, env);
    if (!session) {
      const response = jsonResponse({ authenticated: false }, 401);
      response.headers.append("Set-Cookie", clearCookieHeader(SESSION_COOKIE_NAME));
      return response;
    }
    return jsonResponse({
      authenticated: true,
      user: {
        id: session.identityHash,
        email: session.record.email,
        name: session.record.name,
        picture: session.record.picture
      },
      csrfToken: session.record.csrfToken,
      expiresAt: session.record.expiresAt
    });
  } catch (error) {
    return authErrorResponse(error, "Nao foi possivel validar a sessao.");
  }
}
