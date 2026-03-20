// Access control utilities

export const ROLES = {
  ADMIN: 'admin',
  TEAM_MANAGER: 'team_manager',
  VIEWER: 'viewer'
};

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN;
}

export function isTeamManager(user) {
  return user?.role === ROLES.TEAM_MANAGER;
}

export function isViewer(user) {
  return user?.role === ROLES.VIEWER;
}

export function canManageTeam(user, teamId) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isTeamManager(user)) {
    return user.managed_team_ids?.includes(teamId) || false;
  }
  return false;
}

export function canManageUsers(user) {
  return isAdmin(user);
}

export function canViewTeam(user, teamId) {
  // Everyone can view teams
  return true;
}

export function canManageTeamMembers(user, teamId) {
  return canManageTeam(user, teamId);
}

export function canManageSprints(user, teamId) {
  return canManageTeam(user, teamId);
}

export function canManageAllocations(user, teamId) {
  return canManageTeam(user, teamId);
}

export function canManageWorkAreas(user, workArea) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isTeamManager(user)) {
    const teamId = workArea.leading_team_id;
    return canManageTeam(user, teamId);
  }
  return false;
}

export function getAccessibleTeams(user, allTeams) {
  if (!user) return [];
  if (isAdmin(user)) return allTeams;
  if (isTeamManager(user)) {
    return allTeams.filter(team => user.managed_team_ids?.includes(team.id));
  }
  return allTeams; // Viewers can see all teams
}

export function getManageableTeams(user, allTeams) {
  if (!user) return [];
  if (isAdmin(user)) return allTeams;
  if (isTeamManager(user)) {
    return allTeams.filter(team => user.managed_team_ids?.includes(team.id));
  }
  return [];
}