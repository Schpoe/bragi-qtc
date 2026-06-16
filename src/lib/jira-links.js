// Helpers for building clickable links to Jira issues.

// A Jira issue key looks like PROD-123, MOBILE-45, etc. (project key + number).
const JIRA_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

/**
 * @param {string} value
 * @returns {boolean} true if value looks like a Jira issue key
 */
export function isJiraKey(value) {
  return typeof value === "string" && JIRA_KEY_RE.test(value.trim());
}

/**
 * Build a browse URL for a Jira issue key.
 * @param {string|null|undefined} baseUrl - e.g. https://acme.atlassian.net
 * @param {string|null|undefined} key - e.g. PROD-123
 * @returns {string|null} the browse URL, or null if either input is missing/invalid
 */
export function jiraIssueUrl(baseUrl, key) {
  if (!baseUrl || !key) return null;
  if (!isJiraKey(key)) return null;
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/browse/${encodeURIComponent(key.trim())}`;
}
