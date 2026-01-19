import type { FastifyInstance } from "fastify";
import { decodeJWT } from "./jwt";

export interface IDTokenPayload {
  sub: string; // Subject (user ID from IDP)
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  iat?: number;
  exp?: number;
  aud?: string;
  iss?: string;
}

/**
 * Decode and validate ID token from IDP
 * Note: In production, you should also verify the signature using the IDP's public key
 */
export function decodeIdToken(
  fastify: FastifyInstance,
  idToken: string,
): IDTokenPayload | null {
  try {
    // For now, just decode without verification
    // In production, use the IDP's JWKS endpoint to verify the signature
    const decoded = decodeJWT(fastify, idToken) as IDTokenPayload | null;

    if (!decoded || !decoded.sub || !decoded.email) {
      return null;
    }

    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Extract user info from ID token claims
 */
export function extractUserInfoFromIdToken(idToken: IDTokenPayload) {
  return {
    email: idToken.email,
    name: idToken.name || idToken.email.split("@")[0],
    externalId: idToken.sub,
    picture: idToken.picture,
    emailVerified: idToken.email_verified || false,
  };
}
