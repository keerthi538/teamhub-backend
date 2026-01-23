import type { FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";

export interface JWTPayload {
  id: number;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Create a JWT token for internal use using Fastify JWT
 */
export function createJWT(
  fastify: FastifyInstance,
  payload: JWTPayload,
  expiresIn: string | number = "24h",
): string {
  return fastify.jwt.sign(payload, { expiresIn });
}

/**
 * Verify and decode JWT token using Fastify JWT
 */
export function verifyJWT(
  fastify: FastifyInstance,
  token: string,
): JWTPayload | null {
  try {
    return fastify.jwt.verify(token) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Decode JWT without verification (for extracting claims)
 * Uses Fastify JWT to decode without signature verification
 */
export function decodeJWT(
  fastify: FastifyInstance,
  token: string,
): JWTPayload | null {
  try {
    return fastify.jwt.decode(token) as JWTPayload | null;
  } catch (error) {
    return null;
  }
}
