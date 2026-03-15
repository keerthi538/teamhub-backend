import type { FastifyInstance } from "fastify";
import { generatePKCE } from "./pkce";
import { env } from "../../config/env";
import { oauth } from "../../config/oauth";
import { createJWT } from "./jwt";
import { decodeIdToken, extractUserInfoFromIdToken } from "./idtoken";
import { prisma } from "../../plugins/prisma";
import crypto from "crypto";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "../../utils/password";

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

interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

interface SigninRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  id: number;
  email: string;
  name: string | null;
  currentTeamId: number | null;
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
            name: userInfo?.name ?? "",
          },
          create: {
            email: userInfo?.email,
            name: userInfo?.name ?? "",
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
            name: userInfo?.name ?? "Unknown user",
            lastActiveAt: user.lastActiveAt,
          },
          expiresIn,
        );

        // Store our JWT token in secure cookie (not the IDP's token)
        reply.setCookie(oauth.tokenCookieName, jwtToken, {
          httpOnly: true,
          secure: env.isProduction,
          sameSite: env.isProduction ? "none" : "lax", // Use "none" for production if frontend is on a different domain
          maxAge: expiresIn,
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

  fastify.get("/logout", async (request, reply) => {
    reply.clearCookie(oauth.tokenCookieName, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      path: "/",
    });
    return reply.redirect(env.frontendUrl);
  });

  fastify.post<{ Body: SignupRequest }>("/signup", async (request, reply) => {
    try {
      const { name, email, password } = request.body;

      // Validate required fields
      if (!name || !email || !password) {
        reply.code(400);
        return { error: "Missing required fields: name, email, password" };
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        reply.code(400);
        return {
          error: "Invalid email format",
        };
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        reply.code(400);
        return {
          error: "Password does not meet requirements",
          details: passwordValidation.errors,
        };
      }

      // Check if email already exists with a password
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser && existingUser.password) {
        // Email already exists with password auth
        reply.code(409);
        return {
          error:
            "This email is already registered. Please sign in with your password or use a different email.",
        };
      }

      // Hash the password
      const hashedPassword = await hashPassword(password);

      // Create or update user
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name,
          password: hashedPassword,
        },
        create: {
          email,
          name,
          password: hashedPassword,
        },
        include: {
          currentTeam: true,
          memberships: {
            include: {
              team: true,
            },
          },
        },
      });

      const expiresIn = 20 * 60; // 20 min

      // Create JWT token
      const jwtToken = createJWT(
        fastify,
        {
          id: user.id,
          email: user.email,
          currentTeamId: user.currentTeamId,
          name: user.name ?? "Unknown user",
          lastActiveAt: user.lastActiveAt,
        },
        expiresIn,
      );

      // Set JWT in secure cookie
      reply.setCookie(oauth.tokenCookieName, jwtToken, {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: env.isProduction ? "none" : "lax", // Use "none" for production if frontend is on a different domain
        maxAge: expiresIn,
        path: "/",
      });

      reply.code(201);
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        currentTeam: user.currentTeam,
        profileColor: user.profileColor,
        currentTeamRole: "",
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: "Failed to complete signup" };
    }
  });

  fastify.post<{ Body: SigninRequest }>("/signin", async (request, reply) => {
    try {
      const { email, password } = request.body;

      // Validate required fields
      if (!email || !password) {
        reply.code(400);
        return { error: "Missing required fields: email, password" };
      }

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          currentTeam: true,
          memberships: {
            include: {
              team: true,
            },
          },
        },
      });

      if (!user) {
        reply.code(401);
        return { error: "Invalid email or password" };
      }

      // Check if user has a password (email/password auth)
      if (!user.password) {
        reply.code(401);
        return {
          error:
            "This email is linked to Google Sign-In. You can sign up with a password using the same email to enable password login, or continue with 'Sign in with Google'.",
        };
      }

      // Verify password
      const passwordMatch = await verifyPassword(password, user.password);

      if (!passwordMatch) {
        reply.code(401);
        return { error: "Invalid email or password" };
      }

      const expiresIn = 20 * 60; // 20 min

      // Create JWT token
      const jwtToken = createJWT(
        fastify,
        {
          id: user.id,
          email: user.email,
          currentTeamId: user.currentTeamId,
          name: user.name ?? "Unknown user",
          lastActiveAt: user.lastActiveAt,
        },
        expiresIn,
      );

      // Set JWT in secure cookie
      reply.setCookie(oauth.tokenCookieName, jwtToken, {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: env.isProduction ? "none" : "lax", // Use "none" for production if frontend is on a different domain
        maxAge: expiresIn,
        path: "/",
      });

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        currentTeam: user.currentTeam ?? null,
        profileColor: user.profileColor,
        currentTeamRole: user.currentTeam
          ? user.memberships.find((m) => m.teamId === user.currentTeamId)?.role
          : null,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: "Failed to complete signin" };
    }
  });
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
