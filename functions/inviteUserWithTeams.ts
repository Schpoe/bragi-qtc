import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can invite users
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { email, role, managed_team_ids = [] } = await req.json();

    // Send the invitation
    await base44.users.inviteUser(email, role);

    // Store pending team assignments if provided
    if (managed_team_ids.length > 0) {
      await base44.asServiceRole.entities.PendingUserTeams.create({
        email: email.toLowerCase(),
        managed_team_ids,
        created_at: new Date().toISOString()
      });
    }

    return Response.json({ 
      success: true, 
      message: 'Invitation sent successfully' 
    });
  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});