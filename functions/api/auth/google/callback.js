import {
  OAUTH_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  AuthError,
  appOrigin,
  authErrorResponse,
  clearCookieHeader,
  consumeOAuthState,
  cookieHeader,
  createSession,
  exchangeGoogleCode,
  googleConfig,
  parseCookies,
  secureEqual,
  verifyGoogleIdToken
} from "../../../../cloudflare-auth.mjs";

function clearOAuthCookie(response) {
  response.headers.append("Set-Cookie", clearCookieHeader(OAUTH_COOKIE_NAME));
  return response;
}

function authErrorCategory(error) {
  const code = error instanceof AuthError ? error.code : "AUTH_INTERNAL_ERROR";
  if (code === "GOOGLE_AUTHORIZATION_DENIED") return "access_denied";
  if (code === "AUTH_CONFIG_MISSING" || code === "AUTH_CONFIG_INVALID" || code === "STORAGE_UNAVAILABLE") {
    return "configuration";
  }
  if (code === "GOOGLE_CODE_EXCHANGE_FAILED" || code === "GOOGLE_ID_TOKEN_MISSING" || code === "GOOGLE_KEYS_UNAVAILABLE") {
    return "token_exchange";
  }
  return "invalid_callback";
}

function callbackErrorResponse(error, env) {
  try {
    const location = new URL("/", appOrigin(env));
    location.searchParams.set("auth_error", authErrorCategory(error));
    const response = new Response(null, {
      status: 302,
      headers: {
        "Cache-Control": "no-store",
        Location: location.toString(),
        "Referrer-Policy": "no-referrer"
      }
    });
    return clearOAuthCookie(response);
  } catch {
    return clearOAuthCookie(authErrorResponse(error, "Nao foi possivel concluir o login com Google."));
  }
}

export async function onRequestGet({ request, env }) {
  try {
    const config = googleConfig(env);
    const requestUrl = new URL(request.url);
    const state = requestUrl.searchParams.get("state") || "";
    const oauthCookie = parseCookies(request)[OAUTH_COOKIE_NAME] || "";
    if (!state || !oauthCookie || !await secureEqual(state, oauthCookie)) {
      throw new AuthError("OAUTH_STATE_INVALID", 401);
    }

    const storedState = await consumeOAuthState(env, state);
    if (!storedState
      || storedState.origin !== config.origin
      || storedState.redirectUri !== config.redirectUri
      || !storedState.nonce
      || !storedState.verifier) {
      throw new AuthError("OAUTH_STATE_EXPIRED", 401);
    }
    if (requestUrl.searchParams.get("error")) {
      throw new AuthError("GOOGLE_AUTHORIZATION_DENIED", 401);
    }
    const code = requestUrl.searchParams.get("code") || "";
    if (!code) throw new AuthError("GOOGLE_CODE_MISSING", 400);

    const idToken = await exchangeGoogleCode(config, {
      code,
      verifier: storedState.verifier
    });
    const identity = await verifyGoogleIdToken(idToken, {
      clientId: config.clientId,
      nonce: storedState.nonce
    });
    const session = await createSession(env, identity);
    const returnTo = typeof storedState.returnTo === "string" ? storedState.returnTo : "/";
    const headers = new Headers({
      "Cache-Control": "no-store",
      Location: new URL(returnTo, config.origin).toString(),
      "Referrer-Policy": "no-referrer"
    });
    headers.append("Set-Cookie", cookieHeader(SESSION_COOKIE_NAME, session.token, SESSION_TTL_SECONDS));
    headers.append("Set-Cookie", clearCookieHeader(OAUTH_COOKIE_NAME));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    if (!(error instanceof AuthError)) {
      console.error(JSON.stringify({ message: "google callback failed", error: String(error) }));
    }
    return callbackErrorResponse(error, env);
  }
}
