import type { FastifyInstance } from "fastify";
import { generatePKCE } from "./pkce";
import { env } from "../../config/env";
import { oauth } from "../../config/oauth";
import { createJWT } from "./jwt";
import { decodeIdToken, extractUserInfoFromIdToken } from "./idtoken";
import { prisma } from "../../plugins/prisma";
import crypto from "crypto";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  id_token?: string;
}

interface CallbackQuery {
  code: string;
  state: string;
  error?: string;
  error_description?: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.get("/login", async (request, reply) => {
    try {
      // const { codeChallenge, codeVerifier } = generatePKCE();

      // Generate state for CSRF protection
      const state = crypto.randomBytes(32).toString("base64url");

      // Store code verifier in session/cookie for later verification
      // reply.setCookie(oauth.pkceVerifierCookieName, codeVerifier, {
      //   httpOnly: true,
      //   secure: env.isProduction,
      //   sameSite: "lax",
      //   maxAge: oauth.pkceVerifierMaxAge,
      // });

      // Store state in session/cookie for later verification
      reply.setCookie(oauth.stateCookieName, state, {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: "lax",
        maxAge: oauth.pkceVerifierMaxAge,
      });

      // Get redirect URI - use config or construct from request
      const redirectUri = oauth.redirectUri;

      // Build authorization URL with PKCE parameters
      const params = new URLSearchParams({
        client_id: oauth.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: oauth.scope,
        // code_challenge: codeChallenge,
        // code_challenge_method: "S256",
        state,
      });

      const authorizationUrl = `${oauth.idpUrl}?${params.toString()}`;
      return reply.redirect(authorizationUrl);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: "Failed to initiate login" };
    }
  });

  fastify.get<{ Querystring: CallbackQuery }>(
    "/callback",
    async (request, reply) => {
      try {
        const { code, state, error, error_description } = request.query;

        // Check for authorization errors from IDP
        if (error) {
          fastify.log.error(`IDP error: ${error} - ${error_description}`);
          reply.code(400);
          return { error: `Authorization failed: ${error}` };
        }

        // Validate required parameters
        if (!code || !state) {
          reply.code(400);
          return { error: "Missing code or state parameter" };
        }

        // Validate state parameter against stored state
        const storedState = request.cookies[oauth.stateCookieName];
        if (!storedState || storedState !== state) {
          fastify.log.error("State mismatch in callback");
          reply.code(400);
          return { error: "Invalid state parameter - possible CSRF attack" };
        }

        // Clear the state cookie after validation
        reply.clearCookie(oauth.stateCookieName, {
          httpOnly: true,
          secure: env.isProduction,
          sameSite: "lax",
        });

        // // Get PKCE verifier from cookie
        // const codeVerifier = request.cookies[oauth.pkceVerifierCookieName];
        // if (!codeVerifier) {
        //   reply.code(400);
        //   return { error: "PKCE verifier not found. Session may have expired" };
        // }

        // // Clear the PKCE verifier cookie after use
        // reply.clearCookie(oauth.pkceVerifierCookieName, {
        //   httpOnly: true,
        //   secure: env.isProduction,
        //   sameSite: "lax",
        // });

        // Get redirect URI - use config or construct from request
        const redirectUri = oauth.redirectUri;

        // Exchange authorization code for tokens from IDP
        const idpTokenResponse = await exchangeCodeForToken(
          code,
          // codeVerifier, // TODO: Later enable PKCE
          "",
          redirectUri,
        );

        // Verify and decode the ID token
        if (!idpTokenResponse.id_token) {
          reply.code(400);
          return { error: "ID token not provided by IDP" };
        }

        const idTokenPayload = await decodeIdToken(
          idpTokenResponse.id_token,
          oauth.jwksUri, // Google's JWKS endpoint
          oauth.clientId,
          oauth.oauthIssuer,
        );

        if (!idTokenPayload) {
          reply.code(401);
          return { error: "Invalid ID token" };
        }

        // Extract user info from ID token
        const userInfo = extractUserInfoFromIdToken(idTokenPayload);

        if (!userInfo.emailVerified) {
          reply.code(403);
          return { error: "Email not verified by identity provider" };
        }

        if (!userInfo.email) {
          reply.code(400);
          return { error: "Email not provided in ID token" };
        }

        // Create or fetch internal user
        const user = await prisma.user.upsert({
          where: { email: userInfo.email },
          update: {
            name: userInfo.name ?? "",
          },
          create: {
            email: userInfo.email,
            name: userInfo.name ?? "",
          },
        });

        const expiresIn = 20 * 60; // 20 min

        // Create our own JWT token
        const jwtToken = createJWT(
          fastify,
          {
            id: user.id,
            email: user.email,
            currentTeamId: user.currentTeamId,
          },
          expiresIn,
        );

        // Store our JWT token in secure cookie (not the IDP's token)
        reply.setCookie(oauth.tokenCookieName, jwtToken, {
          httpOnly: true,
          secure: env.isProduction,
          sameSite: "lax",
          maxAge: expiresIn, // 24 hours
          path: "/",
        });

        // Redirect to dashboard or home page
        return reply.redirect(env.frontendUrl);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to complete authentication" };
      }
    },
  );
}

async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
    redirect_uri: redirectUri,
    // code_verifier: codeVerifier,
  });

  const response = await fetch(oauth.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Token exchange failed: ${error.error || response.statusText}`,
    );
  }

  return response.json();
}
