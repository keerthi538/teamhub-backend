import { createRemoteJWKSet } from "jose";

// JWKS verifier instances cached by URI
const jwksVerifiers = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * Get or create a JWKS verifier for the given URI
 * This ensures we only create one verifier instance per JWKS endpoint
 */
export function getJWKSVerifier(jwksUri: string) {
  if (!jwksVerifiers.has(jwksUri)) {
    jwksVerifiers.set(jwksUri, createRemoteJWKSet(new URL(jwksUri)));
  }
  return jwksVerifiers.get(jwksUri)!;
}
