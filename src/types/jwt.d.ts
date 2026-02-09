import "@fastify/jwt";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      // Required for auth tokens
      id?: number;
      email?: string;
      currentTeamId?: number | null;
      name?: string | null;

      // Required for collaboration tokens
      documentUuid?: string;
      userId?: number;
      teamId?: number;
      color?: string;
    };
    user: {
      id: number;
      email: string;
      name: string;
      currentTeamId?: number | null;
    };
  }
}
