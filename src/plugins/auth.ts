import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "./prisma";

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("authenticate", async (request, reply) => {
    try {
      const decoded = await request.jwtVerify<{
        id: number;
        email: string;
        name: string;
        currentTeamId: number | null;
        lastActiveAt?: Date;
      }>();

      request.user = {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        currentTeamId: decoded.currentTeamId,
        lastActiveAt: decoded.lastActiveAt,
      };

      const lastActive = new Date(request.user.lastActiveAt || 0);
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      if (lastActive.getTime() < fiveMinutesAgo.getTime()) {
        await prisma.user
          .update({
            where: { id: request.user.id },
            data: { lastActiveAt: new Date() },
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error("Authentication failed:", err);
      reply.code(401).send({ message: "Unauthorized" });
    }
  });
};

export default fp(authPlugin);
