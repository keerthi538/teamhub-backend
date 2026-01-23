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

        return newTeam;
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to create team" };
      }
    },
  );
}
