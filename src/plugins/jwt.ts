import type { FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";

export async function jwtPlugin(fastify: FastifyInstance) {
  const secret =
    process.env.JWT_SECRET || "your-secret-key-change-in-production";

  await fastify.register(jwt, {
    secret,
  });
}
