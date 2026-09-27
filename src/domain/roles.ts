// Permission check — admin flag is the only gate; role labels are descriptive only
export function canManageTeam(isAdmin: boolean): boolean {
  return isAdmin;
}
export function canRsvp(isMember: boolean): boolean {
  return isMember;
}
