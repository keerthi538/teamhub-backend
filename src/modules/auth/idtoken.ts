import { jwtVerify } from "jose";
import { getJWKSVerifier } from "../../config/jwks";

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
 * Decode and validate ID token from IDP using JWKS
 */
export async function decodeIdToken(
  idToken: string,
  jwksUri: string,
  expectedAudience: string,
  expectedIssuer: string,
): Promise<IDTokenPayload | null> {
  try {
    console.log("Decoding and verifying ID Token");

    const jwks = getJWKSVerifier(jwksUri);

    // Verify and decode the token
    const verified = await jwtVerify(idToken, jwks, {
      audience: expectedAudience,
      issuer: expectedIssuer,
    });

    const payload = verified.payload as IDTokenPayload;
    console.log("ID Token verified successfully:", payload);

    if (!payload.sub || !payload.email || typeof payload.email !== "string") {
      console.error("ID token missing required claims");
      return null;
    }

    return payload;
  } catch (error) {
    console.error("Error verifying ID token:", error);
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
