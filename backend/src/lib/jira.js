const fetch = require('node-fetch');

function getJiraHeaders() {
  const { JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');
  return {
    Authorization: `Basic ${auth}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function isConfigured() {
  return !!(process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);
}

function mapStatusToProgress(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('backlog') || s.includes('to do')) return 0;
  if (s.includes('in progress') || s.includes('in development')) return 30;
  if (s.includes('review') || s.includes('testing')) return 60;
  if (s.includes('done') || s.includes('closed') || s.includes('resolved')) return 100;
  return 0;
}

async function fetchIssue(issueKey) {
  const url = `${process.env.JIRA_BASE_URL}/rest/api/3/issue/${issueKey}`;
  const res = await fetch(url, { headers: getJiraHeaders() });
  if (!res.ok) return null;
  return res.json();
}

async function fetchFieldMap() {
  const url = `${process.env.JIRA_BASE_URL}/rest/api/3/field`;
  const res = await fetch(url, { headers: getJiraHeaders() });
  if (!res.ok) throw new Error('Failed to fetch Jira fields');
  const fields = await res.json();
  const map = {};
  fields.forEach(f => { map[f.name] = f.id; });
  return map;
}

async function searchJql(jql) {
  const url = `${process.env.JIRA_BASE_URL}/rest/api/3/search/jql`;
  let allIssues = [];
  let nextPageToken = null;

  do {
    const body = { jql, maxResults: 100, fields: ['*all'] };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const res = await fetch(url, {
      method: 'POST',
      headers: getJiraHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      let details = text;
      try {
        const json = JSON.parse(text);
        details = json.errorMessages?.join(', ') || json.message || text;
      } catch {}
      throw Object.assign(new Error(`Jira search failed (HTTP ${res.status}): ${details}`), { status: res.status });
    }

    const data = await res.json();
    allIssues = allIssues.concat(data.issues || []);
    nextPageToken = data.nextPageToken || null;
  } while (nextPageToken);

  return allIssues;
}

module.exports = { isConfigured, fetchIssue, fetchFieldMap, searchJql, mapStatusToProgress };
