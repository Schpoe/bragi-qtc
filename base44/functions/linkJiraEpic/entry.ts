import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workAreaId, epicKey } = await req.json();

    if (!workAreaId || !epicKey) {
      return Response.json({ error: 'workAreaId and epicKey are required' }, { status: 400 });
    }

    // Verify Jira epic exists and get its details
    const jiraBaseUrl = Deno.env.get('JIRA_BASE_URL');
    const jiraEmail = Deno.env.get('JIRA_EMAIL');
    const jiraApiToken = Deno.env.get('JIRA_API_TOKEN');

    if (!jiraBaseUrl || !jiraEmail || !jiraApiToken) {
      return Response.json({ error: 'Jira credentials not configured' }, { status: 500 });
    }

    const auth = btoa(`${jiraEmail}:${jiraApiToken}`);
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json'
    };

    // Validate epic exists
    const epicUrl = `${jiraBaseUrl}/rest/api/3/issue/${epicKey}`;
    const epicResponse = await fetch(epicUrl, { headers });

    if (!epicResponse.ok) {
      return Response.json({ error: `Jira epic ${epicKey} not found` }, { status: 404 });
    }

    const epic = await epicResponse.json();
    if (epic.fields?.issuetype?.name !== 'Epic') {
      return Response.json({ error: `${epicKey} is not an Epic` }, { status: 400 });
    }

    // Get current work area
    const workArea = await base44.entities.WorkArea.get(workAreaId);
    
    // Add epic key to linked_epic_keys array (avoid duplicates)
    const linkedEpics = workArea.linked_epic_keys || [];
    if (!linkedEpics.includes(epicKey)) {
      linkedEpics.push(epicKey);
    }

    // Update work area
    await base44.entities.WorkArea.update(workAreaId, {
      linked_epic_keys: linkedEpics
    });

    return Response.json({
      success: true,
      epicKey,
      epicSummary: epic.fields.summary,
      linkedEpics
    });

  } catch (error) {
    console.error('Link epic error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});