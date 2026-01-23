// import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";

// export const authPlugin: FastifyPluginAsync = async (fastify) => {
//   //   fastify.decorate(
//   //     "authenticate",
//   //     async (request: FastifyRequest, reply: FastifyReply) => {
//   //       try {
//   //         const token = request.cookies?.access_token;

//   //         if (!token) {
//   //           reply.code(401);
//   //           throw new Error("Missing token");
//   //         }

//   //         const decoded = await request.jwtVerify<{ id: number; email: string }>({
//   //           token,
//   //         });

//   //         request.user = decoded;
//   //       } catch (err) {
//   //         reply.code(401);
//   //         throw err;
//   //       }
//   //     },
//   //   );

//   fastify.decorate(
//     "authenticate",
//     async (request: FastifyRequest, reply: FastifyReply) => {
//       try {
//         fastify.log.info({ cookies: request.cookies }, "auth cookies");

//         await request.jwtVerify();

//         fastify.log.info({ user: request.user }, "auth user");
//       } catch {
//         reply.code(401);
//         throw new Error("Unauthorized");
//       }
//     },
//   );
// };

import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("authenticate", async (request, reply) => {
    try {
      const decoded = await request.jwtVerify<{
        id: number;
        email: string;
      }>();

      request.user = {
        id: decoded.id,
        email: decoded.email,
      };
    } catch (err) {
      console.error("Authentication failed:", err);
      reply.code(401).send({ message: "Unauthorized" });
    }
  });
};

export default fp(authPlugin);
