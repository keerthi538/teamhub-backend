import crypto from "crypto";

/**
 * Generate PKCE code verifier and challenge
 * @returns Object with codeVerifier and codeChallenge
 */
export function generatePKCE(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  // Generate a random 32-byte string and base64url encode it
  const codeVerifier = crypto.randomBytes(32).toString("base64url");

  // Create SHA256 hash of the verifier and base64url encode it
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return {
    codeVerifier,
    codeChallenge,
  };
}

/**
 * Verify PKCE code verifier against challenge
 * @param codeVerifier - The code verifier from the request
 * @param codeChallenge - The code challenge that was sent to the IDP
 * @returns boolean indicating if they match
 */
export function verifyPKCE(
  codeVerifier: string,
  codeChallenge: string,
): boolean {
  const computedChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return computedChallenge === codeChallenge;
}
