import type { FastifyInstance } from "fastify";
import { prisma } from "../../plugins/prisma";

export async function teamsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Reply: unknown }>("/", async (request, reply) => {
    if (!request.user?.id) {
      reply.code(401);
      return { error: "Unauthorized" };
    }
    try {
      const memberships = await prisma.membership.findMany({
        where: { userId: parseInt(request.user.id) },
        include: {
          team: true,
        },
      });
      return memberships.map((membership) => membership.team);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);
      return { error: "Failed to fetch teams" };
    }
  });
}
