import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jql } = await req.json();

    if (!jql) {
      return Response.json({ error: 'jql is required' }, { status: 400 });
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

    // Fetch all issues from Jira with pagination using nextPageToken
    let allIssues = [];
    let nextPageToken = null;
    const maxResults = 100;

    do {
      const searchUrl = `${jiraBaseUrl}/rest/api/3/search/jql`;
      
      const requestBody = {
        jql: jql,
        maxResults: maxResults
      };
      
      if (nextPageToken) {
        requestBody.nextPageToken = nextPageToken;
      }
      
      const response = await fetch(searchUrl, { 
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        return Response.json({ 
          error: 'Failed to fetch from Jira', 
          details: errorText,
          status: response.status 
        }, { status: response.status });
      }

      const data = await response.json();
      allIssues = allIssues.concat(data.issues || []);
      nextPageToken = data.nextPageToken || null;
    } while (nextPageToken);

    const issues = allIssues;

    // Process issues and extract unique types and teams
    const workAreaTypes = new Set();
    const teams = new Set();
    const workAreas = [];

    for (const issue of issues) {
      const fields = issue.fields || {};
      const issueType = fields.issuetype?.name || '';
      const summary = fields.summary || '';
      
      // Extract teams from custom fields
      let leadingTeam = '';
      let supportingTeams = [];
      
      // Look for team fields in custom fields
      for (const [key, value] of Object.entries(fields)) {
        const lowerKey = key.toLowerCase();
        
        if (lowerKey.includes('leading') && lowerKey.includes('team')) {
          // Leading team field
          if (value && typeof value === 'object') {
            leadingTeam = value.value || value.name || '';
          } else if (value) {
            leadingTeam = value;
          }
          if (leadingTeam) teams.add(leadingTeam);
        } else if (lowerKey.includes('supporting') || lowerKey.includes('contributing')) {
          // Supporting/contributing teams field
          if (Array.isArray(value)) {
            supportingTeams = value.map(v => v.value || v.name || v).filter(Boolean);
            supportingTeams.forEach(t => teams.add(t));
          } else if (value && typeof value === 'object') {
            const teamName = value.value || value.name;
            if (teamName) {
              supportingTeams.push(teamName);
              teams.add(teamName);
            }
          } else if (value) {
            supportingTeams.push(value);
            teams.add(value);
          }
        } else if (lowerKey.includes('team') && !leadingTeam) {
          // Generic team field as fallback for leading team
          if (value && typeof value === 'object') {
            const teamName = value.value || value.name;
            if (teamName) {
              leadingTeam = teamName;
              teams.add(teamName);
            }
          } else if (value) {
            leadingTeam = value;
            teams.add(value);
          }
        }
      }

      if (issueType) {
        workAreaTypes.add(issueType);
      }

      workAreas.push({
        key: issue.key,
        name: summary,
        type: issueType,
        leadingTeam: leadingTeam,
        supportingTeams: supportingTeams,
        rawFields: fields
      });
    }

    return Response.json({
      success: true,
      workAreaTypes: Array.from(workAreaTypes),
      teams: Array.from(teams),
      workAreas: workAreas,
      totalIssues: issues.length
    });

  } catch (error) {
    console.error('Jira sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});