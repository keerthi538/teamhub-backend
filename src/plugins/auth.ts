import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("authenticate", async (request, reply) => {
    try {
      const decoded = await request.jwtVerify<{
        id: number;
        email: string;
        currentTeamId: number | null;
      }>();

      request.user = {
        id: decoded.id,
        email: decoded.email,
        currentTeamId: decoded.currentTeamId,
      };
    } catch (err) {
      console.error("Authentication failed:", err);
      reply.code(401).send({ message: "Unauthorized" });
    }
  });
};

export default fp(authPlugin);
