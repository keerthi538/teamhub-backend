import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { env } from "../config/env";

async function corsPlugin(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: env.frontendUrl,
    credentials: true,
  });
}

export default fp(corsPlugin);
