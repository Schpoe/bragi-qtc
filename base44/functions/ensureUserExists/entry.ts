import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user already exists in User entity
    const users = await base44.asServiceRole.entities.User.list();
    const existingUser = users.find(u => u.email === user.email);

    if (existingUser) {
      return Response.json({ userRecord: existingUser });
    }

    // Create user record with service role if it doesn't exist
    const userRecord = await base44.asServiceRole.entities.User.create({
      email: user.email,
      role: 'viewer',
      managed_team_ids: []
    });

    return Response.json({ userRecord });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});