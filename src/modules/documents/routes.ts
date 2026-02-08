import fastify, { type FastifyInstance } from "fastify";
import { prisma } from "../../plugins/prisma";
import * as Y from "yjs";

export async function documentsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Reply: unknown }>(
    "/",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const currentTeamId = request.user?.currentTeamId;

      if (!currentTeamId) {
        reply.code(400);
        return { error: "User has no current team selected" };
      }

      try {
        const documents = await prisma.document.findMany({
          where: { teamId: currentTeamId },
          select: {
            id: true,
            uuid: true,
            title: true,
            teamId: true,
            published: true,
            author: { select: { name: true } },
          },
        });

        return documents.map((doc) => ({
          id: doc.id,
          uuid: doc.uuid,
          name: doc.title,
          teamId: doc.teamId,
          author: {
            name: doc.author.name,
          },
          lastEdited: null,
          status: doc.published ? "PUBLISHED" : "DRAFT",
        }));
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to fetch documents" };
      }
    },
  );

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

        // Empty yjs state for collaboration
        const ydoc = new Y.Doc();
        const emptyState = Y.encodeStateAsUpdate(ydoc);

        const document = await prisma.document.create({
          data: {
            title: "New Document",
            content: "",
            yjsState: Buffer.from(emptyState),
            authorId: request.user.id,
            teamId: teamId,
          },

          select: {
            id: true,
            uuid: true, // For collaboration
            title: true,
            content: true,
            published: true,
            authorId: true,
            teamId: true,
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

  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params;

      try {
        const document = await prisma.document.findUnique({
          where: { uuid: id },
        });

        if (!document) {
          reply.code(404);
          return { error: "Document not found" };
        }

        return document;
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to retrieve document" };
      }
    },
  );

  fastify.put<{
    Params: { id: string };
    Body: { title?: string; content?: string };
  }>("/:id", { preHandler: fastify.authenticate }, async (request, reply) => {
    const { id } = request.params;
    const { title, content } = request.body;

    try {
      const updatedDocument = await prisma.document.update({
        where: { id: Number(id) },
        data: { title: title ?? "Untitled", content: content ?? "" },
      });

      return updatedDocument;
    } catch (error) {
      fastify.log.error(error);
      reply.code(500);

      return { error: "Failed to update document" };
    }
  });
}
