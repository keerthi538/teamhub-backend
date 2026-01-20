import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { routes } from "./routes";
import jwtPlugin from "./plugins/jwt";
import jwksPlugin from "./plugins/jwks";
import { env } from "./config/env";

export async function createApp() {
  const fastify = Fastify({
    logger: true,
  });

  // Register JWKS plugin
  await fastify.register(jwksPlugin);
  // Register JWT plugin
  await fastify.register(jwtPlugin);
  // Register cookie plugin
  await fastify.register(cookie, {
    secret: env.cookieSecret,
  });

  // Register routes
  await fastify.register(routes);

  return fastify;
}
