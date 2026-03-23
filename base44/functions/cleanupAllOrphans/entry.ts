import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all entities
    const teams = await base44.asServiceRole.entities.Team.list();
    const teamMembers = await base44.asServiceRole.entities.TeamMember.list();
    const sprints = await base44.asServiceRole.entities.Sprint.list();
    const allocations = await base44.asServiceRole.entities.Allocation.list();
    const workAreas = await base44.asServiceRole.entities.WorkArea.list();

    const teamIds = new Set(teams.map(t => t.id));
    const memberIds = new Set(teamMembers.map(m => m.id));
    const sprintIds = new Set(sprints.map(s => s.id));
    const workAreaIds = new Set(workAreas.map(wa => wa.id));

    let deletedCount = 0;
    const summary = {
      orphanedMembers: 0,
      orphanedSprints: 0,
      orphanedAllocations: 0,
      orphanedWorkAreas: 0,
    };

    // 1. Delete team members belonging to non-existent teams
    const orphanedMembers = teamMembers.filter(m => m.team_id && !teamIds.has(m.team_id));
    for (const member of orphanedMembers) {
      await base44.asServiceRole.entities.TeamMember.delete(member.id);
      summary.orphanedMembers++;
      deletedCount++;
    }

    // 2. Delete sprints belonging to non-existent teams (excluding cross-team sprints)
    const orphanedSprints = sprints.filter(s => !s.is_cross_team && s.team_id && !teamIds.has(s.team_id));
    for (const sprint of orphanedSprints) {
      await base44.asServiceRole.entities.Sprint.delete(sprint.id);
      summary.orphanedSprints++;
      deletedCount++;
    }

    // Refresh member and sprint IDs after cleanup
    const remainingMembers = await base44.asServiceRole.entities.TeamMember.list();
    const remainingSprints = await base44.asServiceRole.entities.Sprint.list();
    const remainingMemberIds = new Set(remainingMembers.map(m => m.id));
    const remainingSprintIds = new Set(remainingSprints.map(s => s.id));

    // 3. Delete allocations referencing deleted members, sprints, or work areas
    const orphanedAllocations = allocations.filter(a =>
      !remainingMemberIds.has(a.team_member_id) ||
      !remainingSprintIds.has(a.sprint_id) ||
      !workAreaIds.has(a.work_area_id)
    );
    for (const allocation of orphanedAllocations) {
      await base44.asServiceRole.entities.Allocation.delete(allocation.id);
      summary.orphanedAllocations++;
      deletedCount++;
    }

    // 4. Delete work areas with non-existent leading teams
    const orphanedWorkAreas = workAreas.filter(wa => wa.leading_team_id && !teamIds.has(wa.leading_team_id));
    for (const workArea of orphanedWorkAreas) {
      await base44.asServiceRole.entities.WorkArea.delete(workArea.id);
      summary.orphanedWorkAreas++;
      deletedCount++;
    }

    return Response.json({
      success: true,
      totalDeleted: deletedCount,
      summary,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});