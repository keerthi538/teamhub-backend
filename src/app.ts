import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { routes } from "./routes";
import jwtPlugin from "./plugins/jwt";
import jwksPlugin from "./plugins/jwks";
import { env } from "./config/env";
import authPlugin from "./plugins/auth";
import corsPlugin from "./plugins/cors";
import websocket from "@fastify/websocket";

export async function createApp() {
  const fastify = Fastify({
    logger: true,
    ignoreTrailingSlash: true,
  });

  await fastify.register(websocket);

  // Register cookie plugin
  await fastify.register(cookie, {
    secret: env.cookieSecret,
  });

  // Register JWKS plugin
  await fastify.register(jwksPlugin);

  // Register JWT plugin
  await fastify.register(jwtPlugin);

  // register auth plugin
  await fastify.register(authPlugin);

  // register cors
  await fastify.register(corsPlugin);

  // Register routes
  await fastify.register(routes);

  return fastify;
}
