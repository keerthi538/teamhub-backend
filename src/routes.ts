import type { FastifyInstance } from "fastify";
import { prisma } from "./plugins/prisma";

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

  // GET /me - Get current user info
  fastify.get("/me", async (request, reply) => {
    if (!request.user?.id) {
      reply.code(401);
      return { error: "Unauthorized" };
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: parseInt(request.user.id) },
        include: {
          memberships: {
            include: {
              team: true,
            },
          },
          documents: true,
        },
      });

      if (!user) {
        reply.code(404);
        return { error: "User not found" };
      }

      return user;
    } catch (error) {
      reply.code(500);
      return { error: "Failed to fetch user" };
    }
  });
}
