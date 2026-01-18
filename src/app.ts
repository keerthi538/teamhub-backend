import Fastify from "fastify";
import { routes } from "./routes";

export async function createApp() {
  const fastify = Fastify({
    logger: true,
  });

  // Register routes
  await fastify.register(routes);

  return fastify;
}
