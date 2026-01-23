import type { FastifyInstance } from "fastify";
import { prisma } from "../../plugins/prisma";

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.get<{ Reply: unknown }>(
    "/me",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.user?.id) {
        reply.code(401);
        return { error: "Unauthorized" };
      }

      try {
        const user = await prisma.user.findUnique({
          where: { id: request.user.id },
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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          memberships: user.memberships,
          documents: user.documents,
        };
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to fetch user" };
      }
    },
  );
}
