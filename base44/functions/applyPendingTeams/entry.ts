import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for pending team assignments
    const pendingRecords = await base44.asServiceRole.entities.PendingUserTeams.filter({
      email: user.email.toLowerCase()
    });

    if (pendingRecords.length > 0) {
      const pending = pendingRecords[0];
      
      // Apply the role and team assignments
      await base44.asServiceRole.entities.User.update(user.id, {
        role: pending.role,
        managed_team_ids: pending.managed_team_ids
      });

      // Delete the pending record
      await base44.asServiceRole.entities.PendingUserTeams.delete(pending.id);

      return Response.json({ 
        success: true, 
        applied: true,
        role: pending.role,
        managed_team_ids: pending.managed_team_ids
      });
    }

    return Response.json({ 
      success: true, 
      applied: false 
    });
  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});