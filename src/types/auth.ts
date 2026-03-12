export interface AuthUser {
  id: number;
  email: string;
  name?: string;
  currentTeamId?: number | null;
  lastActiveAt?: Date;
}

export enum TeamRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
  VIEWER = "VIEWER",
}
