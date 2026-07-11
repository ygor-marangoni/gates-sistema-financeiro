import {
  OAUTH_COOKIE_NAME,
  OAUTH_STATE_TTL_SECONDS,
  appOrigin,
  authErrorResponse,
  buildGoogleAuthorizationUrl,
  clearCookieHeader,
  cookieHeader,
  googleConfig,
  pkceChallenge,
  randomToken,
  safeReturnTo,
  saveOAuthState
} from "../../../../cloudflare-auth.mjs";

export async function onRequestGet({ request, env }) {
  try {
    const config = googleConfig(env);
    const requestUrl = new URL(request.url);
    const state = randomToken(32);
    const nonce = randomToken(32);
    const verifier = randomToken(48);
    const challenge = await pkceChallenge(verifier);
    const returnTo = safeReturnTo(requestUrl.searchParams.get("returnTo"), config.origin);

    await saveOAuthState(env, state, {
      nonce,
      origin: config.origin,
      redirectUri: config.redirectUri,
      returnTo,
      verifier
    });

    const location = buildGoogleAuthorizationUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
      nonce,
      challenge
    });
    const headers = new Headers({
      "Cache-Control": "no-store",
      Location: location,
      "Referrer-Policy": "no-referrer"
    });
    headers.append("Set-Cookie", cookieHeader(OAUTH_COOKIE_NAME, state, OAUTH_STATE_TTL_SECONDS));
    return new Response(null, { status: 302, headers });
  } catch (error) {
    try {
      const origin = appOrigin(env);
      const headers = new Headers({
        "Cache-Control": "no-store",
        Location: `${origin}/?auth_error=configuration`,
        "Referrer-Policy": "no-referrer"
      });
      headers.append("Set-Cookie", clearCookieHeader(OAUTH_COOKIE_NAME));
      return new Response(null, { status: 302, headers });
    } catch {
      // Without a trusted application origin there is nowhere safe to redirect.
    }
    return authErrorResponse(error, "Nao foi possivel iniciar o login com Google.");
  }
}
