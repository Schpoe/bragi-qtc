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
  let nextPageToken = undefined;

  do {
    const body = { jql, maxResults: 50 };
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
    const page = data.issues || [];
    console.log(`[jira] searchJql page=${page.length} isLast=${data.isLast} keys=${Object.keys(data).join(',')}`);
    allIssues = allIssues.concat(page);
    nextPageToken = data.isLast ? undefined : data.nextPageToken;
  } while (nextPageToken);

  return allIssues;
}

// Parse "Q2 2025" → { start: "2025-04-01", end: "2025-06-30" }
function getQuarterDateRange(quarter) {
  const match = quarter.match(/Q(\d)\s+(\d{4})/i);
  if (!match) return null;
  const q = parseInt(match[1]);
  const year = parseInt(match[2]);
  const ranges = { 1: ['01-01', '03-31'], 2: ['04-01', '06-30'], 3: ['07-01', '09-30'], 4: ['10-01', '12-31'] };
  const [start, end] = ranges[q] || [];
  if (!start) return null;
  return { start: `${year}-${start}`, end: `${year}-${end}` };
}

// Find the story points field ID from a Jira field map
function detectStoryPointsField(fieldMap) {
  const candidates = ['Story Points', 'Story point estimate', 'Story points', 'SP', 'Story Point'];
  for (const name of candidates) {
    if (fieldMap[name]) return fieldMap[name];
  }
  return 'customfield_10016'; // most common fallback
}

module.exports = { isConfigured, fetchIssue, fetchFieldMap, searchJql, mapStatusToProgress, getQuarterDateRange, detectStoryPointsField, getJiraHeaders };
