export const oauth = {
  idpUrl: process.env.IDP_URL || "https://idp.example.com/oauth/authorize",
  tokenUrl: process.env.IDP_TOKEN_URL || "https://idp.example.com/oauth/token",
  clientId: process.env.IDP_CLIENT_ID || "",
  clientSecret: process.env.IDP_CLIENT_SECRET || "",
  redirectUri: process.env.IDP_REDIRECT_URI,
  scope: process.env.IDP_SCOPE || "openid profile email",
  pkceVerifierCookieName: "pkce_verifier",
  pkceVerifierMaxAge: 10 * 60, // 10 minutes in seconds
  stateCookieName: "oauth_state",
  tokenCookieName: "access_token",
  tokenMaxAge: 24 * 60 * 60, // 24 hours in seconds
};
