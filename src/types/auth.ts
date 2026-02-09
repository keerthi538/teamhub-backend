export interface AuthUser {
  id: number;
  email: string;
  name?: string;
  currentTeamId?: number | null;
}

export enum TeamRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
  VIEWER = "VIEWER",
}
