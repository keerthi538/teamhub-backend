import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      id: number;
      email: string;
      currentTeamId?: number | null;
    };
    user: {
      id: number;
      email: string;
      currentTeamId?: number | null;
    };
  }
}
