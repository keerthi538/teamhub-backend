import fastify, { type FastifyInstance } from "fastify";
import { prisma } from "../../plugins/prisma";
import * as Y from "yjs";
import WebSocket from "ws";
import type { FastifyRequest } from "fastify/types/request";

// Store active Yjs documents in memory
const docs = new Map<string, Y.Doc>();

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
            title: true,
            teamId: true,
            published: true,
            author: { select: { name: true } },
          },
        });

        return documents.map((doc) => ({
          id: doc.id,
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

  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params;

      try {
        const document = await prisma.document.findUnique({
          where: { id: Number(id) },
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

  fastify.get<{ Params: { id: string } }>(
    "/:id/collaborate",
    { websocket: true },
    async (
      socket: WebSocket,
      request: FastifyRequest<{ Params: { id: string } }>,
    ) => {
      const documentId = request.params.id;
      const docIdNum = Number(documentId);

      try {
        const document = await prisma.document.findUnique({
          where: { id: docIdNum },
          select: { id: true, teamId: true, yjsState: true },
        });

        if (!document) {
          socket.close(1008, "Document not found");
          return;
        }

        let ydoc: Y.Doc;

        // Check if document is already in memory
        if (docs.has(documentId)) {
          ydoc = docs.get(documentId)!;
          fastify.log.info(`Using cached document: ${documentId}`);
        } else {
          // Create new Yjs document
          ydoc = new Y.Doc();

          // Restore state from database if exists
          if (document.yjsState) {
            Y.applyUpdate(ydoc, new Uint8Array(document.yjsState));
            fastify.log.info(`Restored document ${documentId} from database`);
          }

          // Store in memory
          docs.set(documentId, ydoc);

          // Setup auto-save to database (debounced)
          let saveTimeout: NodeJS.Timeout;
          ydoc.on("update", async (update: Uint8Array) => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(async () => {
              try {
                const state = Y.encodeStateAsUpdate(ydoc);
                await prisma.document.update({
                  where: { id: docIdNum },
                  data: {
                    yjsState: Buffer.from(state),
                    // updatedAt: new Date(),
                  },
                });
                fastify.log.info(`Saved document ${documentId} to database`);
              } catch (error) {
                fastify.log.error(
                  `Failed to save document ${documentId}:`,
                  // error,
                );
              }
            }, 2000); // Save 2 seconds after last update
          });
        }

        // Handle incoming updates from this client
        socket.on("message", (data: Buffer) => {
          const update = new Uint8Array(data);
          Y.applyUpdate(ydoc, update);
        });

        // Broadcast updates to this client
        const updateHandler = (update: Uint8Array) => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(Buffer.from(update));
          }
        };
        ydoc.on("update", updateHandler);

        // Send initial state to the connecting client
        const initialState = Y.encodeStateAsUpdate(ydoc);
        socket.send(Buffer.from(initialState));

        fastify.log.info(`Client connected to document: ${documentId}`);

        // Cleanup on disconnect
        socket.on("close", () => {
          ydoc.off("update", updateHandler);
          fastify.log.info(`Client disconnected from document: ${documentId}`);
        });
      } catch (error) {
        fastify.log.error(
          `WebSocket connection error: ${JSON.stringify(error)}`,
        );
        socket.close(1011, "Internal server error");
      }
    },
  );
}
