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

    // Map custom roles to base44 invitation roles (only "user" or "admin" allowed)
    const inviteRole = role === 'admin' ? 'admin' : 'user';
    
    // Send the invitation
    await base44.users.inviteUser(email, inviteRole);

    // Store pending assignments (role + team assignments)
    await base44.asServiceRole.entities.PendingUserTeams.create({
      email: email.toLowerCase(),
      role,
      managed_team_ids,
      created_at: new Date().toISOString()
    });

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