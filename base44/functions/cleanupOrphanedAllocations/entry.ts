import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const allocations = await base44.asServiceRole.entities.Allocation.list();
    const teamMembers = await base44.asServiceRole.entities.TeamMember.list();
    const workAreas = await base44.asServiceRole.entities.WorkArea.list();

    const memberIds = new Set(teamMembers.map(m => m.id));
    const workAreaIds = new Set(workAreas.map(wa => wa.id));

    const orphanedAllocations = allocations.filter(a =>
      !memberIds.has(a.team_member_id) || !workAreaIds.has(a.work_area_id)
    );

    for (const allocation of orphanedAllocations) {
      await base44.asServiceRole.entities.Allocation.delete(allocation.id);
    }

    return Response.json({
      success: true,
      deletedCount: orphanedAllocations.length,
      message: `Deleted ${orphanedAllocations.length} orphaned allocations`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});