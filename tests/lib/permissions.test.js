import { describe, it, expect } from 'vitest';
import {
  isAdmin,
  isTeamManager,
  isViewer,
  canManageTeam,
  canManageUsers,
  canManageTeamMembers,
  canCreateSprint,
  canCreateWorkArea,
  canManageWorkAreaTypes,
  canManageSprints,
  canManageAllocations,
  canManageWorkAreas,
  getAccessibleTeams,
  getManageableTeams,
} from '@/lib/permissions';

const adminUser = { role: 'admin', managed_team_ids: [] };
const managerUser = { role: 'team_manager', managed_team_ids: ['team-1', 'team-2'] };
const viewerUser = { role: 'viewer', managed_team_ids: [] };
const nullUser = null;

const allTeams = [
  { id: 'team-1', name: 'Team Alpha' },
  { id: 'team-2', name: 'Team Beta' },
  { id: 'team-3', name: 'Team Gamma' },
];

describe('role predicates', () => {
  it('isAdmin returns true only for admin role', () => {
    expect(isAdmin(adminUser)).toBe(true);
    expect(isAdmin(managerUser)).toBe(false);
    expect(isAdmin(viewerUser)).toBe(false);
    expect(isAdmin(nullUser)).toBe(false);
  });

  it('isTeamManager returns true only for team_manager role', () => {
    expect(isTeamManager(managerUser)).toBe(true);
    expect(isTeamManager(adminUser)).toBe(false);
    expect(isTeamManager(viewerUser)).toBe(false);
    expect(isTeamManager(nullUser)).toBe(false);
  });

  it('isViewer returns true only for viewer role', () => {
    expect(isViewer(viewerUser)).toBe(true);
    expect(isViewer(adminUser)).toBe(false);
    expect(isViewer(managerUser)).toBe(false);
    expect(isViewer(nullUser)).toBe(false);
  });
});

describe('canManageTeam', () => {
  it('admin can manage any team', () => {
    expect(canManageTeam(adminUser, 'team-1')).toBe(true);
    expect(canManageTeam(adminUser, 'team-99')).toBe(true);
  });

  it('team manager can only manage their own teams', () => {
    expect(canManageTeam(managerUser, 'team-1')).toBe(true);
    expect(canManageTeam(managerUser, 'team-2')).toBe(true);
    expect(canManageTeam(managerUser, 'team-3')).toBe(false);
  });

  it('viewer cannot manage any team', () => {
    expect(canManageTeam(viewerUser, 'team-1')).toBe(false);
  });

  it('returns false for null user', () => {
    expect(canManageTeam(nullUser, 'team-1')).toBe(false);
  });
});

describe('canManageUsers', () => {
  it('only admin can manage users', () => {
    expect(canManageUsers(adminUser)).toBe(true);
    expect(canManageUsers(managerUser)).toBe(false);
    expect(canManageUsers(viewerUser)).toBe(false);
  });
});

describe('canManageTeamMembers', () => {
  it('admin can manage members of any team', () => {
    expect(canManageTeamMembers(adminUser, 'team-1')).toBe(true);
  });

  it('team manager can manage members of their own teams', () => {
    expect(canManageTeamMembers(managerUser, 'team-1')).toBe(true);
    expect(canManageTeamMembers(managerUser, 'team-3')).toBe(false);
  });

  it('viewer cannot manage team members', () => {
    expect(canManageTeamMembers(viewerUser, 'team-1')).toBe(false);
  });
});

describe('canCreateSprint', () => {
  it('admin and team manager can create sprints', () => {
    expect(canCreateSprint(adminUser)).toBe(true);
    expect(canCreateSprint(managerUser)).toBe(true);
  });

  it('viewer cannot create sprints', () => {
    expect(canCreateSprint(viewerUser)).toBe(false);
  });
});

describe('canCreateWorkArea', () => {
  it('admin and team manager can create work items', () => {
    expect(canCreateWorkArea(adminUser)).toBe(true);
    expect(canCreateWorkArea(managerUser)).toBe(true);
  });

  it('viewer cannot create work items', () => {
    expect(canCreateWorkArea(viewerUser)).toBe(false);
  });
});

describe('canManageWorkAreaTypes', () => {
  it('only admin can manage work item types', () => {
    expect(canManageWorkAreaTypes(adminUser)).toBe(true);
    expect(canManageWorkAreaTypes(managerUser)).toBe(false);
    expect(canManageWorkAreaTypes(viewerUser)).toBe(false);
  });
});

describe('canManageSprints', () => {
  it('admin can manage sprints for any team', () => {
    expect(canManageSprints(adminUser, 'team-1')).toBe(true);
    expect(canManageSprints(adminUser, 'team-99')).toBe(true);
  });

  it('team manager can manage sprints for their own teams only', () => {
    expect(canManageSprints(managerUser, 'team-1')).toBe(true);
    expect(canManageSprints(managerUser, 'team-3')).toBe(false);
  });

  it('viewer cannot manage sprints', () => {
    expect(canManageSprints(viewerUser, 'team-1')).toBe(false);
  });
});

describe('canManageAllocations', () => {
  it('admin can manage allocations for any team', () => {
    expect(canManageAllocations(adminUser, 'team-1')).toBe(true);
  });

  it('team manager can manage allocations for their own teams', () => {
    expect(canManageAllocations(managerUser, 'team-1')).toBe(true);
    expect(canManageAllocations(managerUser, 'team-3')).toBe(false);
  });

  it('viewer cannot manage allocations', () => {
    expect(canManageAllocations(viewerUser, 'team-1')).toBe(false);
  });
});

describe('canManageWorkAreas', () => {
  const workArea = { leading_team_id: 'team-1' };

  it('admin can manage any work area', () => {
    expect(canManageWorkAreas(adminUser, workArea)).toBe(true);
  });

  it('team manager can manage work areas they lead', () => {
    expect(canManageWorkAreas(managerUser, workArea)).toBe(true);
    expect(canManageWorkAreas(managerUser, { leading_team_id: 'team-3' })).toBe(false);
  });

  it('viewer cannot manage work areas', () => {
    expect(canManageWorkAreas(viewerUser, workArea)).toBe(false);
  });

  it('returns false for null user', () => {
    expect(canManageWorkAreas(nullUser, workArea)).toBe(false);
  });
});

describe('getAccessibleTeams', () => {
  it('admin can access all teams', () => {
    expect(getAccessibleTeams(adminUser, allTeams)).toEqual(allTeams);
  });

  it('team manager can access only their teams', () => {
    const result = getAccessibleTeams(managerUser, allTeams);
    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toEqual(['team-1', 'team-2']);
  });

  it('viewer can see all teams', () => {
    expect(getAccessibleTeams(viewerUser, allTeams)).toEqual(allTeams);
  });

  it('returns empty array for null user', () => {
    expect(getAccessibleTeams(nullUser, allTeams)).toEqual([]);
  });
});

describe('getManageableTeams', () => {
  it('admin can manage all teams', () => {
    expect(getManageableTeams(adminUser, allTeams)).toEqual(allTeams);
  });

  it('team manager can manage only their own teams', () => {
    const result = getManageableTeams(managerUser, allTeams);
    expect(result).toHaveLength(2);
    expect(result.map(t => t.id)).toEqual(['team-1', 'team-2']);
  });

  it('viewer cannot manage any team', () => {
    expect(getManageableTeams(viewerUser, allTeams)).toEqual([]);
  });

  it('returns empty array for null user', () => {
    expect(getManageableTeams(nullUser, allTeams)).toEqual([]);
  });
});
