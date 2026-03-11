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

    // Fetch field metadata to map field names to IDs
    const fieldsResponse = await fetch(`${jiraBaseUrl}/rest/api/3/field`, { headers });
    if (!fieldsResponse.ok) {
      return Response.json({ error: 'Failed to fetch Jira fields' }, { status: 500 });
    }
    const allFields = await fieldsResponse.json();
    
    // Map field names to their custom field IDs
    const fieldMap = {};
    allFields.forEach(field => {
      fieldMap[field.name] = field.id;
    });
    
    const leadingTeamField = fieldMap['Leading Team'];
    const contributingTeamsField = fieldMap['Contributing Teams'];
    const typeField = fieldMap['Type'];

    // Fetch all issues from Jira with pagination using nextPageToken
    let allIssues = [];
    let nextPageToken = null;
    const maxResults = 100;

    do {
      const searchUrl = `${jiraBaseUrl}/rest/api/3/search/jql`;
      
      const requestBody = {
        jql: jql,
        maxResults: maxResults,
        fields: ['*all']
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
    let sampleCustomFields = [];

    for (const issue of issues) {
      const fields = issue.fields || {};
      
      // Get sample of custom field keys from first issue
      if (issues.indexOf(issue) === 0) {
        sampleCustomFields = Object.keys(fields).filter(k => k.startsWith('customfield'));
      }
      
      const issueType = fields.issuetype?.name || '';
      const summary = fields.summary || '';
      
      // Extract teams and type from mapped custom fields
      let leadingTeam = '';
      let supportingTeams = [];
      let workAreaType = issueType;
      
      // Leading Team
      if (leadingTeamField && fields[leadingTeamField]) {
        const value = fields[leadingTeamField];
        if (value && typeof value === 'object') {
          leadingTeam = value.value || value.name || '';
        } else if (value) {
          leadingTeam = value;
        }
        if (leadingTeam) teams.add(leadingTeam);
      }
      
      // Contributing Teams
      if (contributingTeamsField && fields[contributingTeamsField]) {
        const value = fields[contributingTeamsField];
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
      }
      
      // Type (override issue type if custom field exists)
      if (typeField && fields[typeField]) {
        const value = fields[typeField];
        if (value && typeof value === 'object') {
          workAreaType = value.value || value.name || issueType;
        } else if (value) {
          workAreaType = value;
        }
      }

      if (workAreaType) {
        workAreaTypes.add(workAreaType);
      }

      workAreas.push({
        key: issue.key,
        name: summary,
        type: workAreaType,
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
      totalIssues: issues.length,
      fieldMapping: {
        leadingTeam: leadingTeamField,
        contributingTeams: contributingTeamsField,
        type: typeField
      }
    });

  } catch (error) {
    console.error('Jira sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});