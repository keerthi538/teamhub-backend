import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      // Required for auth tokens
      id?: number;
      email?: string;
      currentTeamId?: number | null;

      // Required for collaboration tokens
      documentUuid?: string;
      userId?: number;
      teamId?: number;
    };
    user: {
      id: number;
      email: string;
      currentTeamId?: number | null;
    };
  }
}
