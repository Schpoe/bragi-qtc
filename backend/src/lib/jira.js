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

// fetch wrapper that retries on 429 (rate limit) / 503, honouring Retry-After.
// Large Jira projects can rate-limit a burst of requests; this prevents a single
// 429 from failing the whole actuals fetch.
async function fetchWithRetry(url, options = {}, retries = 4) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
    if ((res.status === 429 || res.status === 503) && attempt < retries) {
      const ra = parseInt(res.headers.get('retry-after') || '', 10);
      const waitMs = (Number.isNaN(ra) ? Math.min(2 ** attempt, 8) : Math.min(ra, 30)) * 1000;
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    return res;
  }
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
  const res = await fetchWithRetry(url, { headers: getJiraHeaders() });
  if (!res.ok) return null;
  return res.json();
}

async function fetchFieldMap() {
  const url = `${process.env.JIRA_BASE_URL}/rest/api/3/field`;
  const res = await fetch(url, { headers: getJiraHeaders(), signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error('Failed to fetch Jira fields');
  const fields = await res.json();
  const map = {};
  fields.forEach(f => { map[f.name] = f.id; });
  return map;
}

// Paginates through all matching issues. Stops early once `maxTotal` issues have
// been collected (backstop for very large projects); the result carries a
// `.truncated` flag when more issues exist beyond the cap.
async function searchJql(jql, fields = ['summary', 'status', 'issuetype', 'parent', 'customfield_10016', 'customfield_10024', 'customfield_10028'], maxTotal = Infinity) {
  const url = `${process.env.JIRA_BASE_URL}/rest/api/3/search/jql`;
  let allIssues = [];
  let nextPageToken = undefined;
  let truncated = false;

  do {
    const body = { jql, maxResults: 50, fields };
    if (nextPageToken) body.nextPageToken = nextPageToken;

    const res = await fetchWithRetry(url, {
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
    allIssues = allIssues.concat(page);
    nextPageToken = data.isLast ? undefined : data.nextPageToken;

    if (nextPageToken && allIssues.length >= maxTotal) {
      truncated = true;
      nextPageToken = undefined;
    }
  } while (nextPageToken);

  allIssues.truncated = truncated;
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

// Find the story points field ID — env var takes priority, then auto-detect, then fallback
function detectStoryPointsField(fieldMap) {
  if (process.env.JIRA_STORY_POINTS_FIELD) return process.env.JIRA_STORY_POINTS_FIELD;
  const candidates = ['Story Points', 'Story point estimate', 'Story points', 'SP', 'Story Point'];
  for (const name of candidates) {
    if (fieldMap[name]) return fieldMap[name];
  }
  return 'customfield_10016'; // most common fallback
}

// Find the "Epic Link" field ID (company-managed projects store the epic key here,
// whereas team-managed projects use the `parent` field). Env var > auto-detect > fallback.
function detectEpicLinkField(fieldMap) {
  if (process.env.JIRA_EPIC_LINK_FIELD) return process.env.JIRA_EPIC_LINK_FIELD;
  const candidates = ['Epic Link', 'Parent Link', 'Epic'];
  for (const name of candidates) {
    if (fieldMap[name]) return fieldMap[name];
  }
  return 'customfield_10014'; // most common fallback
}

module.exports = { isConfigured, fetchIssue, fetchFieldMap, searchJql, mapStatusToProgress, getQuarterDateRange, detectStoryPointsField, detectEpicLinkField, getJiraHeaders };
