import { env } from "./env";

export const oauth = {
  idpUrl: env.googleAuthorizeUrl,
  tokenUrl: env.googleTokenUrl,
  clientId: env.googleClientId,
  clientSecret: env.googleClientSecret,
  redirectUri: env.googleRedirectUri,
  jwksUri: env.googleJwksUri,
  scope: process.env.IDP_SCOPE || "openid profile email",
  pkceVerifierCookieName: "pkce_verifier",
  pkceVerifierMaxAge: 10 * 60, // 10 minutes in seconds
  stateCookieName: "oauth_state",
  tokenCookieName: "access_token",
  tokenMaxAge: 24 * 60 * 60, // 24 hours in seconds
  oauthIssuer: "https://accounts.google.com",
};
