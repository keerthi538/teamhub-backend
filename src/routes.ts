import type { FastifyInstance } from "fastify";
import { prisma } from "./plugins/prisma";
import { authRoutes } from "./modules/auth";
import { usersRoutes } from "./modules/users";
import { teamsRoutes } from "./modules/teams";
import { documentsRoutes } from "./modules/documents/routes";

export async function routes(fastify: FastifyInstance) {
  // GET /ping - Simple ping endpoint
  fastify.get("/ping", async (request, reply) => {
    return { message: "pong" };
  });

  // GET /health - Health check endpoint
  fastify.get("/health", async (request, reply) => {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      reply.code(503);
      return {
        status: "error",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

  fastify.get("/", async (request, reply) => {
    return { message: "Welcome to teamhub dashboard" };
  });

  // Register module routes
  await fastify.register(authRoutes, { prefix: "/auth" });
  await fastify.register(usersRoutes, { prefix: "/users" });
  await fastify.register(teamsRoutes, { prefix: "/teams" });
  await fastify.register(documentsRoutes, { prefix: "/documents" });
}
