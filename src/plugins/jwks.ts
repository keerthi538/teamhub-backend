import type { FastifyInstance } from "fastify";
import { getJWKSVerifier } from "../config/jwks";
import { env } from "../config/env";
import fp from "fastify-plugin";

function jwksPlugin(fastify: FastifyInstance) {
  // Initialize Google's JWKS verifier on app startup
  const googleJwksUri = env.googleJwksUri;

  try {
    fastify.log.info(`Initializing JWKS verifier for ${googleJwksUri}`);
    getJWKSVerifier(googleJwksUri);
    fastify.log.info("JWKS verifier initialized successfully");
  } catch (error) {
    fastify.log.error(`Failed to initialize JWKS verifier: ${error}`);
    throw error;
  }
}

export default fp(jwksPlugin);