import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "../../plugins/prisma";
import { Role } from "../../generated/prisma/enums";
import { env } from "../../config/env";
import { oauth } from "../../config/oauth";
import { isValidTeamRole } from "../../utils";

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

        const newToken = await reply.jwtSign({
          id: request.user.id,
          email: request.user.email,
          currentTeamId: Number(newTeam.id),
        });

        reply.setCookie(oauth.tokenCookieName, newToken, {
          httpOnly: true,
          secure: env.isProduction,
          sameSite: "lax",
          path: "/", // important
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

        const newToken = await reply.jwtSign({
          id: request.user.id,
          email: request.user.email,
          currentTeamId: Number(teamId),
        });

        reply.setCookie(oauth.tokenCookieName, newToken, {
          httpOnly: true,
          secure: env.isProduction,
          sameSite: "lax",
          path: "/", // important
        });

        return { message: `Switched to team ${teamId}` };
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to switch team" };
      }
    },
  );

  fastify.get<{ Reply: unknown }>(
    "/members",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.user?.id) {
        reply.code(401);
        return { error: "Unauthorized" };
      }

      const currentTeamId = request.user.currentTeamId;
      if (!currentTeamId) {
        reply.code(400);
        return { error: "No current team selected" };
      }

      try {
        const memberships = await prisma.membership.findMany({
          where: { teamId: currentTeamId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                profileColor: true,
                lastActiveAt: true,
              },
            },
          },
        });

        return memberships.map((membership) => ({
          id: membership.user.id,
          name: membership.user.name,
          email: membership.user.email,
          role: membership.role,
          profileColor: membership.user.profileColor,
          lastActive: membership.user.lastActiveAt,
        }));
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to fetch team members" };
      }
    },
  );

  fastify.post<{ Body: { email: string; role: string } }>(
    "/members/add",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.user?.id) {
        reply.code(401);
        return { error: "Unauthorized" };
      }

      const currentTeamId = request.user.currentTeamId;
      if (!currentTeamId) {
        reply.code(400);
        return { error: "No current team selected" };
      }

      const { email, role } = request.body;
      try {
        const userToAdd = await prisma.user.findUnique({
          where: { email: email },
        });

        if (!userToAdd) {
          reply.code(404);
          return { error: "User not found" };
        }

        if (!isValidTeamRole(role)) {
          reply.code(404);
          return { error: "Invalid role" };
        }

        const existingMembership = await prisma.membership.findFirst({
          where: {
            userId: userToAdd.id,
            teamId: currentTeamId,
          },
        });

        if (existingMembership) {
          reply.code(400);
          return { error: "User is already a member of the team" };
        }

        await prisma.membership.create({
          data: {
            userId: userToAdd.id,
            teamId: currentTeamId,
            role: role,
          },
        });

        return {
          id: userToAdd.id,
          name: userToAdd.name,
          email: userToAdd.email,
          role: role,
        };
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to add user to the team" };
      }
    },
  );
}
