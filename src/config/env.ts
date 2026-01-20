export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  isDevelopment: process.env.NODE_ENV !== "production",
  isProduction: process.env.NODE_ENV === "production",
  cookieSecret: process.env.COOKIE_SECRET || "default_secret",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleAuthorizeUrl:
    process.env.GOOGLE_AUTHORIZE_URL ||
    "https://accounts.google.com/o/oauth2/auth",
  googleTokenUrl:
    process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "",
  googleAuthScopes: process.env.GOOGLE_AUTH_SCOPES || "openid profile email",
  googleJwksUri: process.env.GOOGLE_JWKS_URI || "",
};
