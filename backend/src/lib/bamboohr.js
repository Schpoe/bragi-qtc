const fetch = require('node-fetch');

// BambooHR REST client. Auth is HTTP Basic with the API key as the username and
// any non-empty password. Configure BAMBOOHR_SUBDOMAIN (your company domain) and
// BAMBOOHR_API_KEY in the backend .env.

function isConfigured() {
  return !!(process.env.BAMBOOHR_SUBDOMAIN && process.env.BAMBOOHR_API_KEY);
}

function baseUrl() {
  return `https://api.bamboohr.com/api/gateway.php/${process.env.BAMBOOHR_SUBDOMAIN}`;
}

function getHeaders() {
  const auth = Buffer.from(`${process.env.BAMBOOHR_API_KEY}:x`).toString('base64');
  return { Authorization: `Basic ${auth}`, Accept: 'application/json' };
}

// Count Mon–Fri days in an inclusive [start, end] date range (YYYY-MM-DD).
function countWeekdays(start, end) {
  let count = 0;
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (d <= last) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// Employee directory → [{ id, name, email }].
async function fetchDirectory() {
  const res = await fetch(`${baseUrl()}/v1/employees/directory`, { headers: getHeaders(), signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    throw Object.assign(new Error(`BambooHR directory failed (HTTP ${res.status})`), { status: res.status });
  }
  const data = await res.json();
  return (data.employees || []).map(e => ({
    id: String(e.id),
    name: e.displayName || `${e.firstName || ''} ${e.lastName || ''}`.trim() || String(e.id),
    email: e.workEmail || null,
  }));
}

// Approved time-off, summed to weekday days per employee within [start, end].
// Returns { [employeeId]: offWeekdayDays }. Handles partial days via per-date amounts.
async function fetchApprovedTimeOffDays(start, end) {
  const url = `${baseUrl()}/v1/time_off/requests?start=${start}&end=${end}&status=approved`;
  const res = await fetch(url, { headers: getHeaders(), signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    throw Object.assign(new Error(`BambooHR time-off failed (HTTP ${res.status})`), { status: res.status });
  }
  const requests = await res.json();
  const map = {};
  (Array.isArray(requests) ? requests : []).forEach(req => {
    const empId = String(req.employeeId);
    const dates = req.dates || {};
    let days = 0;
    Object.entries(dates).forEach(([d, amt]) => {
      if (d < start || d > end) return;
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
      if (dow === 0 || dow === 6) return; // ignore weekends
      const n = parseFloat(amt);
      if (!Number.isNaN(n)) days += n;
    });
    map[empId] = (map[empId] || 0) + days;
  });
  return map;
}


// Per-employee leave balance + hire date.
// Consultant/external absence policies don't expose a usable "remaining" balance via the
// BambooHR calculator (the balance is opaque and doesn't track accrued-minus-used), but
// `usedYearToDate` is reliable. So for these we compute days-still-to-consume as a fixed
// annual entitlement minus days already taken this period. Entitlement assumes full-time;
// BambooHR exposes no FTE field we can key on, so part-timers would need a manual override.
// Regular leave policies report unused days directly as a positive balance.
const CONSULTANT_POLICY_RE = /consultant|external/i;
const CONSULTANT_ANNUAL_ENTITLEMENT = Number(process.env.CONSULTANT_ANNUAL_ENTITLEMENT) || 56;

// BambooHR exposes no carryover/renewal date, so the renewal anchor is the hire date;
// the route computes the next hire-date anniversary from it. Returns
// { [employeeId]: { balance, hireDate, policyName } } where balance = days still unused.
async function fetchVacationBalances(bamboohrIds) {
  const results = await Promise.allSettled(
    bamboohrIds.map(async id => {
      const [balRes, empRes] = await Promise.all([
        fetch(`${baseUrl()}/v1/employees/${id}/time_off/calculator`, { headers: getHeaders(), signal: AbortSignal.timeout(30_000) }),
        fetch(`${baseUrl()}/v1/employees/${id}?fields=hireDate`, { headers: getHeaders(), signal: AbortSignal.timeout(30_000) }),
      ]);
      if (!balRes.ok) throw new Error(`calculator HTTP ${balRes.status}`);
      if (!empRes.ok) throw new Error(`employee HTTP ${empRes.status}`);
      const policies = await balRes.json();
      const emp = await empRes.json();
      return { id, policies, hireDate: emp.hireDate || null };
    })
  );
  const map = {};
  results.forEach(r => {
    if (r.status !== 'fulfilled') return;
    const { id, policies, hireDate } = r.value;
    const list = Array.isArray(policies) ? policies : [];
    const balance = list.reduce((sum, p) => {
      if (CONSULTANT_POLICY_RE.test(p.name || '')) {
        const used = parseFloat(p.usedYearToDate) || 0;
        return sum + (CONSULTANT_ANNUAL_ENTITLEMENT - used); // days still to consume before renewal
      }
      return sum + (parseFloat(p.balance) || 0); // regular policy: positive balance = days unused
    }, 0);
    map[id] = { balance, hireDate, policyName: list[0]?.name || null };
  });
  return map;
}

module.exports = { isConfigured, countWeekdays, fetchDirectory, fetchApprovedTimeOffDays, fetchVacationBalances };
