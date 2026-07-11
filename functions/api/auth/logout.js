import {
  SESSION_COOKIE_NAME,
  AuthError,
  authErrorResponse,
  clearCookieHeader,
  deleteSession,
  jsonResponse,
  readSession,
  requestHasExpectedOrigin,
  requestHasValidCsrf
} from "../../../cloudflare-auth.mjs";

export async function onRequestPost({ request, env }) {
  try {
    if (!requestHasExpectedOrigin(request, env)) throw new AuthError("ORIGIN_INVALID", 403);
    const session = await readSession(request, env);
    if (session && !await requestHasValidCsrf(request, session)) {
      throw new AuthError("CSRF_INVALID", 403);
    }
    await deleteSession(env, session);
    const response = jsonResponse({ loggedOut: true });
    response.headers.append("Set-Cookie", clearCookieHeader(SESSION_COOKIE_NAME));
    return response;
  } catch (error) {
    return authErrorResponse(error, "Nao foi possivel encerrar a sessao.");
  }
}
