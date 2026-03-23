import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Map Jira status to progress percentage
function mapStatusToProgress(status) {
  const statusLower = (status || '').toLowerCase();
  
  // Common Jira statuses
  if (statusLower.includes('backlog') || statusLower.includes('to do')) return 0;
  if (statusLower.includes('in progress') || statusLower.includes('in development')) return 30;
  if (statusLower.includes('review') || statusLower.includes('testing')) return 60;
  if (statusLower.includes('done') || statusLower.includes('closed') || statusLower.includes('resolved')) return 100;
  
  // Default to 0 for unknown statuses
  return 0;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const jiraBaseUrl = Deno.env.get('JIRA_BASE_URL');
    const jiraEmail = Deno.env.get('JIRA_EMAIL');
    const jiraApiToken = Deno.env.get('JIRA_API_TOKEN');

    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) {
      return Response.json({ error: 'Jira credentials not configured' }, { status: 500 });
    }

    const auth = btoa(`${jiraEmail}:${jiraApiToken}`);
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    // Fetch all work areas with Jira keys
    const workAreas = await base44.asServiceRole.entities.WorkArea.list();
    const workAreasWithJira = workAreas.filter(wa => wa.jira_key);

    console.log(`Found ${workAreasWithJira.length} work areas with Jira keys`);

    let updated = 0;
    let errors = 0;

    // Update each work area with current Jira data
    for (const workArea of workAreasWithJira) {
      try {
        const issueUrl = `${jiraBaseUrl}/rest/api/3/issue/${workArea.jira_key}`;
        const response = await fetch(issueUrl, { headers });

        if (!response.ok) {
          console.error(`Failed to fetch ${workArea.jira_key}: ${response.status}`);
          errors++;
          continue;
        }

        const issue = await response.json();
        const status = issue.fields?.status?.name || '';
        const progress = mapStatusToProgress(status);

        // Update work area with latest Jira data
        await base44.asServiceRole.entities.WorkArea.update(workArea.id, {
          jira_status: status,
          jira_progress: progress,
          last_synced: new Date().toISOString()
        });

        updated++;
      } catch (error) {
        console.error(`Error syncing ${workArea.jira_key}:`, error.message);
        errors++;
      }
    }

    return Response.json({
      success: true,
      message: `Synced ${updated} work areas`,
      total: workAreasWithJira.length,
      updated,
      errors
    });

  } catch (error) {
    console.error('Background sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});