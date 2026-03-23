import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        allowed: false, 
        reason: 'Not authenticated' 
      }, { status: 401 });
    }

    // Check if user exists in User entity
    const users = await base44.asServiceRole.entities.User.list();
    const userExists = users.some(u => u.email === user.email);

    if (!userExists) {
      return Response.json({ 
        allowed: false, 
        reason: 'User not registered in system',
        email: user.email
      }, { status: 403 });
    }

    return Response.json({ 
      allowed: true, 
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name
      }
    });

  } catch (error) {
    console.error('Validate user access error:', error);
    return Response.json({ 
      allowed: false, 
      error: error.message 
    }, { status: 500 });
  }
});