export interface AuthUser {
  id: number;
  email: string;
  currentTeamId?: number | null;
}
