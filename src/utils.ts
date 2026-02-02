import { TeamRole } from "./types/auth";

export function isValidTeamRole(role: string): role is TeamRole {
  return Object.values(TeamRole).includes(role as TeamRole);
}
