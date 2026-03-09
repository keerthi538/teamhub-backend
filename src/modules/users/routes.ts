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
            currentTeam: true,
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
          currentTeam: user.currentTeam,
          profileColor: user.profileColor,
          currentTeamRole:
            user.memberships.find((m) => m.teamId === user.currentTeamId)
              ?.role || "member",
        };
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to fetch user" };
      }
    },
  );

  fastify.patch<{ Body: { profileColor?: string } }>(
    "/profile-color",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.user?.id) {
        reply.code(401);
        return { error: "Unauthorized" };
      }

      const { profileColor } = request.body;

      try {
        const updatedUser = await prisma.user.update({
          where: { id: request.user.id },
          data: { profileColor },
        });

        return {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          profileColor: updatedUser.profileColor,
        };
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to update user" };
      }
    },
  );
}
