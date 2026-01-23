import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      id: number;
      email: string;
    };
    user: {
      id: number;
      email: string;
    };
  }
}
