import type { FastifyInstance } from "fastify";
import jwt from "@fastify/jwt";
import fp from "fastify-plugin";
import { oauth } from "../config/oauth";
import { env } from "../config/env";

async function jwtPlugin(fastify: FastifyInstance) {
  const secret = env.jwtSecret ?? "secret-key";

  await fastify.register(jwt, {
    secret,
    cookie: {
      cookieName: oauth.tokenCookieName, // e.g. "access_token"
      signed: false,
    },
  });
}

export default fp(jwtPlugin, {
  name: "jwt-plugin",
});
