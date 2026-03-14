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
        // Note: Users can see documents they authored or published documents from their team, but not unpublished documents from other authors in the team
        const documents = await prisma.document.findMany({
          where: {
            teamId: currentTeamId,
            OR: [
              { authorId: request.user?.id }, // Is author
              { published: true }, // Is published
            ],
          },
          select: {
            id: true,
            uuid: true,
            title: true,
            teamId: true,
            published: true,
            updatedAt: true,
            author: { select: { name: true, profileColor: true } },
          },
        });

        return documents.map((doc) => ({
          id: doc.id,
          uuid: doc.uuid,
          name: doc.title,
          teamId: doc.teamId,
          author: {
            name: doc.author.name,
            profileColor: doc.author.profileColor,
          },
          lastEdited: doc.updatedAt,
          status: doc.published ? "PUBLISHED" : "DRAFT",
        }));
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to fetch documents" };
      }
    },
  );

  fastify.get<{ Reply: unknown }>(
    "/recent",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.user?.id) {
        reply.code(401);
        return { error: "Unauthorized" };
      }

      try {
        const recentDocs = await prisma.document.findMany({
          where: {
            OR: [
              { authorId: request.user.id },
              {
                team: {
                  memberships: {
                    some: { userId: request.user.id },
                  },
                },
              },
            ],
          },
          orderBy: { lastOpenedAt: "desc" },
          take: 3,
          select: {
            uuid: true,
            title: true,
            author: { select: { name: true } },
            lastOpenedAt: true,
            teamId: true,
          },
        });

        return recentDocs;
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to fetch recent documents" };
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

  fastify.patch<{
    Params: { uuid: string };
    Body: { title: string };
  }>(
    "/:uuid/title",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.user?.id) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      try {
        const { uuid } = request.params;
        const { title } = request.body;

        // Verify user has access to this document
        const document = await prisma.document.findFirst({
          where: {
            uuid,
            OR: [
              { authorId: request.user.id },
              {
                team: {
                  memberships: {
                    some: { userId: request.user.id },
                  },
                },
              },
            ],
          },
        });

        if (!document) {
          return reply.code(403).send({ error: "Access denied" });
        }

        // Update the title
        const updatedDocument = await prisma.document.update({
          where: { uuid },
          data: {
            title: title.trim() || "Untitled document",
          },
          select: {
            uuid: true,
            title: true,
          },
        });

        return {
          success: true,
          title: updatedDocument.title,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to update title" });
      }
    },
  );

  // Generate collaboration token for a document
  fastify.get<{
    Params: { uuid: string };
  }>(
    "/:uuid/token",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.user?.id) {
        reply.code(401);
        return { error: "Unauthorized" };
      }

      try {
        const { uuid } = request.params;

        const user = await prisma.user.findUnique({
          where: { id: request.user.id },
          select: {
            name: true,
            profileColor: true,
          },
        });

        if (!user) {
          return reply.code(404).send({ error: "User not found" });
        }

        // Verify user has access to this document
        const document = await prisma.document.findFirst({
          where: {
            uuid,
            OR: [
              { authorId: request.user.id }, // Is author
              {
                team: {
                  memberships: {
                    some: { userId: request.user.id },
                  },
                },
              }, // Is team member
            ],
          },
        });

        if (!document) {
          reply.code(403);
          return { error: "Access denied" };
        }

        // Generate JWT token for Hocuspocus
        const token = fastify.jwt.sign(
          {
            documentUuid: uuid,
            userId: request.user.id,
            teamId: document.teamId,
            name: user.name,
            color: user.profileColor ?? "#3b82f6",
          },
          { expiresIn: "2h" },
        );

        const documentUpdate = await prisma.document.update({
          where: { uuid },
          data: { lastOpenedAt: new Date() },
        });

        return {
          token,
          user: {
            id: request.user.id,
            name: user.name,
            color: user.profileColor || "#3b82f6",
          },
        };
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to generate token" };
      }
    },
  );

  fastify.patch<{ Params: { uuid: string } }>(
    "/:uuid/publish",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      if (!request.user?.id) {
        reply.code(401);
        return { error: "Unauthorized" };
      }

      try {
        const { uuid } = request.params;

        // Verify user is the author of this document
        const document = await prisma.document.findFirst({
          where: {
            uuid,
            authorId: request.user.id,
          },
        });

        if (!document) {
          reply.code(403);
          return { error: "Access denied" };
        }

        // Toggle published status
        const updatedDocument = await prisma.document.update({
          where: { uuid },
          data: {
            published: !document.published,
          },
          select: {
            uuid: true,
            published: true,
          },
        });

        return {
          success: true,
          published: updatedDocument.published,
        };
      } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return { error: "Failed to update publish status" };
      }
    },
  );
}
