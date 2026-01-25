import fastify, { type FastifyInstance } from "fastify";
import { prisma } from "../../plugins/prisma";

export async function documentsRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: { teamId: number } }>(
    "/create",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.user?.id) {
        reply.code(401);
        return { error: "Unauthorized" };
      }

      try {
        const { teamId } = request.body;

        const document = await prisma.document.create({
          data: {
            title: "New Document",
            content: "",
            authorId: request.user.id,
            teamId: teamId,
          },
        });

        return document;
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to create document" };
      }
    },
  );
}
