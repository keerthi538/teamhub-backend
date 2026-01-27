import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "../../plugins/prisma";
import { Role } from "../../../generated/prisma/enums";

export async function teamsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Reply: unknown }>(
    "/",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.user?.id) {
        reply.code(401);
        return { error: "Unauthorized" };
      }

      try {
        const memberships = await prisma.membership.findMany({
          where: { userId: request.user.id },
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
    },
  );

  fastify.post<{ Body: { teamName: string } }>(
    "/create",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.user?.id) {
        reply.code(401);
        return { error: "Unauthorized" };
      }

      try {
        const teamName = request.body?.teamName;

        if (typeof teamName !== "string" || teamName.trim() === "") {
          reply.code(400);
          return { error: "Invalid team name" };
        }

        const newTeam = await prisma.team.create({
          data: {
            name: teamName,
            memberships: {
              create: {
                userId: request.user.id,
                role: Role.ADMIN,
              },
            },
          },
        });

        const user = await prisma.user.update({
          where: { id: request.user.id },
          data: { currentTeamId: newTeam.id },
        });

        return newTeam;
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to create team" };
      }
    },
  );

  fastify.post<{ Params: { teamId: string } }>(
    "/:teamId/switch",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.user?.id) {
        reply.code(401);
        return { error: "Unauthorized" };
      }

      const { teamId } = request.params;
      const userId = request.user.id;

      try {
        const membership = await prisma.membership.findFirst({
          where: {
            userId: request.user.id,
            teamId: Number(teamId),
          },
        });

        if (!membership) {
          reply.code(403);
          return { error: "You are not a member of this team" };
        }

        const user = await prisma.user.update({
          where: { id: userId },
          data: { currentTeamId: Number(teamId) },
          include: {
            currentTeam: true,
          },
        });

        return { message: `Switched to team ${teamId}` };
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to switch team" };
      }
    },
  );
}
