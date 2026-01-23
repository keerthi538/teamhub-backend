import "fastify";
import { AuthUser } from "./auth";

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}
