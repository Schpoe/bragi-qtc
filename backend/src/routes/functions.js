const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const jira = require('../lib/jira');
const bamboohr = require('../lib/bamboohr');

const router = express.Router();

// Create a user with an initial password (replaces inviteUserWithTeams)
router.post('/inviteUserWithTeams', requireAdmin, async (req, res) => {
  try {
    const { email, role, managed_team_ids = [], initial_password, first_name, last_name, position } = req.body;
    if (!email || !initial_password) {
      return res.status(400).json({ error: 'email and initial_password are required' });
    }
    const password_hash = await bcrypt.hash(initial_password, 10);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), role: role || 'viewer', managed_team_ids, password_hash, first_name, last_name, position },
    });
    const { password_hash: _, ...userOut } = user;
    res.json({ data: { success: true, user: userOut } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Orphan cleanup — removes members/work-areas with missing team references
router.post('/cleanupAllOrphans', requireAdmin, async (_req, res) => {
  try {
    const summary = await prisma.$transaction(async (tx) => {
      const [teams, teamMembers, workAreas] = await Promise.all([
        tx.team.findMany({ select: { id: true } }),
        tx.teamMember.findMany(),
        tx.workArea.findMany(),
      ]);

      const teamIds = new Set(teams.map(t => t.id));
      const result = { orphanedMembers: 0, orphanedWorkAreas: 0 };

      const orphanedMembers = teamMembers.filter(m => m.team_id && !teamIds.has(m.team_id));
      await Promise.all(orphanedMembers.map(m => tx.teamMember.delete({ where: { id: m.id } })));
      result.orphanedMembers = orphanedMembers.length;

      const orphanedWorkAreas = workAreas.filter(w => w.leading_team_id && !teamIds.has(w.leading_team_id));
      await Promise.all(orphanedWorkAreas.map(w => tx.workArea.delete({ where: { id: w.id } })));
      result.orphanedWorkAreas = orphanedWorkAreas.length;

      return result;
    });

    res.json({ data: { success: true, totalDeleted: Object.values(summary).reduce((a, b) => a + b, 0), summary } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

// Test Jira connectivity (credentials + reachability) and return custom field names
router.post('/testJiraConnection', requireAdmin, async (_req, res) => {
  if (!jira.isConfigured()) {
    return res.json({ data: { ok: false, error: 'Jira credentials not configured (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)' } });
  }
  try {
    const fieldMap = await jira.fetchFieldMap();
    const customFields = Object.entries(fieldMap)
      .filter(([, id]) => id.startsWith('customfield_'))
      .map(([name, id]) => ({ name, id }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return res.json({ data: { ok: true, fieldCount: Object.keys(fieldMap).length, baseUrl: process.env.JIRA_BASE_URL, customFields } });
  } catch (err) {
    return res.json({ data: { ok: false, error: err.message } });
  }
});

// Jira preview import
router.post('/jiraSync', requireAdmin, async (req, res) => {
  try {
    if (!jira.isConfigured()) {
      return res.status(400).json({ error: 'Jira credentials not configured (set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN in .env)' });
    }
    const { jql, leadingTeamFieldName, contributingTeamsFieldName } = req.body;
    if (!jql) return res.status(400).json({ error: 'jql is required' });

    const logs = [];

    const fieldMap = await jira.fetchFieldMap();
    const leadingTeamField = fieldMap[leadingTeamFieldName || 'Leading Team'];
    const contributingTeamsField = fieldMap[contributingTeamsFieldName || 'Contributing Teams'];
    const typeField = fieldMap['Type'];

    logs.push(`Connected to ${process.env.JIRA_BASE_URL} — fetched ${Object.keys(fieldMap).length} fields`);
    logs.push(`Field mapping: Leading Team → ${leadingTeamField || '(not found)'}, Contributing Teams → ${contributingTeamsField || '(not found)'}, Type → ${typeField || '(not found)'}`);

    // Request the resolved team/type fields explicitly — searchJql's default field set
    // omits them, which would make every Leading/Contributing Team come back empty.
    const syncFields = ['summary', 'issuetype', leadingTeamField, contributingTeamsField, typeField].filter(Boolean);
    const issues = await jira.searchJql(jql, syncFields);
    logs.push(`JQL returned ${issues.length} issue(s)`);
    if (issues.length === 0) {
      // Try fetching one of the issues directly as a sanity check
      const firstKey = jql.match(/[A-Z]+-\d+/)?.[0];
      if (firstKey) {
        const direct = await jira.fetchIssue(firstKey);
        logs.push(direct
          ? `Direct fetch of ${firstKey} succeeded (type: ${direct.fields?.issuetype?.name}) — search API may lack permission for this issue type`
          : `Direct fetch of ${firstKey} also failed — check Jira credentials`
        );
      }
    }

    const workAreaTypes = new Set();
    const teams = new Set();
    const workAreas = [];

    for (const issue of issues) {
      const fields = issue.fields || {};
      const issueType = fields.issuetype?.name || '';
      let leadingTeam = '';
      let supportingTeams = [];
      let workAreaType = issueType;

      if (leadingTeamField && fields[leadingTeamField]) {
        const v = fields[leadingTeamField];
        leadingTeam = (typeof v === 'object' ? v.value || v.name : v) || '';
        if (leadingTeam) teams.add(leadingTeam);
      }

      if (contributingTeamsField && fields[contributingTeamsField]) {
        const v = fields[contributingTeamsField];
        if (Array.isArray(v)) {
          supportingTeams = v.map(x => x.value || x.name || x).filter(Boolean);
        } else if (v && typeof v === 'object') {
          const name = v.value || v.name;
          if (name) supportingTeams.push(name);
        } else if (v) {
          supportingTeams.push(v);
        }
        supportingTeams.forEach(t => teams.add(t));
      }

      if (typeField && fields[typeField]) {
        const v = fields[typeField];
        workAreaType = (typeof v === 'object' ? v.value || v.name : v) || issueType;
      }

      if (workAreaType) workAreaTypes.add(workAreaType);

      workAreas.push({
        key: issue.key,
        name: fields.summary || '',
        type: workAreaType,
        leadingTeam,
        supportingTeams,
      });
    }

    if (teams.size > 0) logs.push(`Teams found in issues: ${[...teams].join(', ')}`);
    else logs.push('Warning: no leading/contributing team values found in issues (check field mapping)');

    res.json({
      data: {
        success: true,
        logs,
        workAreaTypes: [...workAreaTypes],
        teams: [...teams],
        workAreas,
        totalIssues: issues.length,
        fieldMapping: { leadingTeam: leadingTeamField, contributingTeams: contributingTeamsField, type: typeField },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync Jira status to all work areas that have a jira_key
router.post('/syncJiraIssues', requireAdmin, async (_req, res) => {
  try {
    if (!jira.isConfigured()) {
      return res.status(500).json({ error: 'Jira credentials not configured' });
    }

    const workAreas = await prisma.workArea.findMany({ where: { NOT: { jira_key: null } } });
    let updated = 0;
    let errors = 0;

    for (const wa of workAreas) {
      try {
        const issue = await jira.fetchIssue(wa.jira_key);
        if (!issue) { errors++; continue; }
        const status = issue.fields?.status?.name || '';
        await prisma.workArea.update({
          where: { id: wa.id },
          data: { jira_status: status, jira_progress: jira.mapStatusToProgress(status), last_synced: new Date() },
        });
        updated++;
      } catch {
        errors++;
      }
    }

    res.json({ data: { success: true, message: `Synced ${updated} work areas`, total: workAreas.length, updated, errors } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Link a Jira epic to a work area
router.post('/linkJiraEpic', requireAuth, async (req, res) => {
  try {
    if (!jira.isConfigured()) {
      return res.status(500).json({ error: 'Jira credentials not configured' });
    }

    const { workAreaId, epicKey } = req.body;
    if (!workAreaId || !epicKey) {
      return res.status(400).json({ error: 'workAreaId and epicKey are required' });
    }

    const issue = await jira.fetchIssue(epicKey);
    if (!issue) return res.status(404).json({ error: `Jira issue ${epicKey} not found` });
    if (issue.fields?.issuetype?.name !== 'Epic') {
      return res.status(400).json({ error: `${epicKey} is not an Epic` });
    }

    const workArea = await prisma.workArea.findUnique({ where: { id: workAreaId } });
    if (!workArea) return res.status(404).json({ error: 'Work area not found' });

    const linkedEpics = [...new Set([...(workArea.linked_epic_keys || []), epicKey])];
    await prisma.workArea.update({ where: { id: workAreaId }, data: { linked_epic_keys: linkedEpics } });

    res.json({ data: { success: true, epicKey, epicSummary: issue.fields.summary, linkedEpics } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Revert quarterly plan allocations to a saved snapshot
router.post('/revertQuarterlyPlanSnapshot', requireAuth, async (req, res) => {
  try {
    const { snapshotId } = req.body;
    if (!snapshotId) return res.status(400).json({ error: 'snapshotId is required' });

    const snapshot = await prisma.quarterlyPlanSnapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });

    const user = req.user;
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'team_manager' && (user.managed_team_ids || []).includes(snapshot.team_id);
    if (!isAdmin && !isManager) {
      return res.status(403).json({ error: 'Not authorized to revert this team\'s plan' });
    }

    const snapshotAllocations = Array.isArray(snapshot.allocations) ? snapshot.allocations : [];
    const selectedWorkAreaIds = Array.isArray(snapshot.selected_work_area_ids) ? snapshot.selected_work_area_ids : [];

    // Get all current team members to filter out deleted ones
    const teamMembers = await prisma.teamMember.findMany({
      where: { team_id: snapshot.team_id },
      select: { id: true },
    });
    const existingMemberIds = new Set(teamMembers.map(m => m.id));
    const memberIds = teamMembers.map(m => m.id);

    // Normalise snapshot allocations: old snapshots stored `percent`, new ones store `days`
    const normalisedAllocations = snapshotAllocations.map(a => ({
      ...a,
      days: a.days != null ? a.days : Math.round((a.percent || 0) * 60 / 100),
    }));

    // Only restore allocations for members that still exist
    const restorableAllocations = normalisedAllocations.filter(
      a => a.days > 0 && existingMemberIds.has(a.team_member_id)
    );

    await prisma.$transaction(async (tx) => {
      // Delete all current allocations for this team/quarter
      await tx.quarterlyAllocation.deleteMany({
        where: { quarter: snapshot.quarter, team_member_id: { in: memberIds } },
      });

      // Recreate allocations from snapshot (skipping deleted members)
      for (const alloc of restorableAllocations) {
        await tx.quarterlyAllocation.create({
          data: {
            quarter: snapshot.quarter,
            team_member_id: alloc.team_member_id,
            work_area_id: alloc.work_area_id,
            days: alloc.days,
          },
        });
      }

      // Restore work area selection — use saved list if available,
      // otherwise derive from the allocations being restored (handles old snapshots)
      const workAreaIdsToRestore = selectedWorkAreaIds.length > 0
        ? selectedWorkAreaIds
        : [...new Set(restorableAllocations.map(a => a.work_area_id))];

      const existingSelection = await tx.quarterlyWorkAreaSelection.findFirst({
        where: { team_id: snapshot.team_id, quarter: snapshot.quarter },
      });
      if (existingSelection) {
        await tx.quarterlyWorkAreaSelection.update({
          where: { id: existingSelection.id },
          data: { work_area_ids: workAreaIdsToRestore },
        });
      } else {
        await tx.quarterlyWorkAreaSelection.create({
          data: {
            team_id: snapshot.team_id,
            quarter: snapshot.quarter,
            work_area_ids: workAreaIdsToRestore,
          },
        });
      }

      // Log revert action in history
      const now = new Date();
      for (const alloc of restorableAllocations) {
        await tx.quarterlyPlanHistory.create({
          data: {
            quarter: snapshot.quarter,
            team_id: snapshot.team_id,
            team_name: snapshot.team_name,
            team_member_id: alloc.team_member_id,
            member_name: alloc.member_name || null,
            member_discipline: alloc.member_discipline || null,
            work_area_id: alloc.work_area_id,
            work_area_name: alloc.work_area_name || null,
            work_area_type: alloc.work_area_type || null,
            action: 'reverted',
            old_days: null,
            new_days: alloc.days,
            changed_at: now,
          },
        });
      }
    });

    const restoredCount = restorableAllocations.length;
    const skippedCount = normalisedAllocations.filter(a => a.days > 0).length - restoredCount;
    res.json({ data: { success: true, restored: restoredCount, skipped: skippedCount, label: snapshot.label } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Move or copy a team's plan (allocations + capacity + column selection) between quarters.
router.post('/moveQuarterlyPlan', requireAuth, async (req, res) => {
  try {
    const { teamId, fromQuarter, toQuarter, mode } = req.body;
    if (!teamId || !fromQuarter || !toQuarter) {
      return res.status(400).json({ error: 'teamId, fromQuarter and toQuarter are required' });
    }
    if (fromQuarter === toQuarter) {
      return res.status(400).json({ error: 'Source and target quarter must differ' });
    }
    if (mode !== 'move' && mode !== 'copy') {
      return res.status(400).json({ error: 'mode must be "move" or "copy"' });
    }

    const user = req.user;
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'team_manager' && (user.managed_team_ids || []).includes(teamId);
    if (!isAdmin && !isManager) {
      return res.status(403).json({ error: 'Not authorized to move this team\'s plan' });
    }

    const teamMembers = await prisma.teamMember.findMany({ where: { team_id: teamId }, select: { id: true } });
    const memberIds = teamMembers.map(m => m.id);

    // Collision guard — refuse if the target quarter already holds a plan for this team.
    const [targetAllocations, targetCapacities, targetSelection] = await Promise.all([
      memberIds.length ? prisma.quarterlyAllocation.count({ where: { quarter: toQuarter, team_member_id: { in: memberIds } } }) : 0,
      memberIds.length ? prisma.teamMemberCapacity.count({ where: { quarter: toQuarter, team_member_id: { in: memberIds } } }) : 0,
      prisma.quarterlyWorkAreaSelection.count({ where: { quarter: toQuarter, team_id: teamId } }),
    ]);
    if (targetAllocations + targetCapacities + targetSelection > 0) {
      return res.status(409).json({ error: `Target quarter "${toQuarter}" already has a plan for this team. Clear it first or choose another quarter.` });
    }

    const counts = await prisma.$transaction(async (tx) => {
      if (mode === 'move') {
        const a = memberIds.length
          ? await tx.quarterlyAllocation.updateMany({ where: { quarter: fromQuarter, team_member_id: { in: memberIds } }, data: { quarter: toQuarter } })
          : { count: 0 };
        const c = memberIds.length
          ? await tx.teamMemberCapacity.updateMany({ where: { quarter: fromQuarter, team_member_id: { in: memberIds } }, data: { quarter: toQuarter } })
          : { count: 0 };
        const sel = await tx.quarterlyWorkAreaSelection.updateMany({ where: { quarter: fromQuarter, team_id: teamId }, data: { quarter: toQuarter } });
        return { allocations: a.count, capacities: c.count, selections: sel.count };
      }
      // copy — duplicate source rows under the target quarter, leaving the source intact
      const srcAllocations = memberIds.length
        ? await tx.quarterlyAllocation.findMany({ where: { quarter: fromQuarter, team_member_id: { in: memberIds } } })
        : [];
      for (const a of srcAllocations) {
        await tx.quarterlyAllocation.create({ data: { quarter: toQuarter, team_member_id: a.team_member_id, work_area_id: a.work_area_id, days: a.days } });
      }
      const srcCapacities = memberIds.length
        ? await tx.teamMemberCapacity.findMany({ where: { quarter: fromQuarter, team_member_id: { in: memberIds } } })
        : [];
      for (const c of srcCapacities) {
        await tx.teamMemberCapacity.create({ data: { quarter: toQuarter, team_member_id: c.team_member_id, working_days: c.working_days } });
      }
      const srcSelections = await tx.quarterlyWorkAreaSelection.findMany({ where: { quarter: fromQuarter, team_id: teamId } });
      for (const s of srcSelections) {
        await tx.quarterlyWorkAreaSelection.create({ data: { quarter: toQuarter, team_id: teamId, work_area_ids: s.work_area_ids, column_order: s.column_order } });
      }
      return { allocations: srcAllocations.length, capacities: srcCapacities.length, selections: srcSelections.length };
    });

    res.json({ data: { success: true, mode, ...counts } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch quarterly Jira actuals for a team (completed + in-progress issues)
router.post('/fetchQuarterlyJiraActuals', requireAuth, async (req, res) => {
  try {
    if (!jira.isConfigured()) {
      return res.status(400).json({ error: 'Jira not configured (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)' });
    }
    const { teamId, quarter, prodKeys = [] } = req.body;
    if (!teamId || !quarter) {
      return res.status(400).json({ error: 'teamId and quarter are required' });
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.jira_project_key) {
      return res.status(400).json({ error: `Team "${team.name}" has no Jira project key. Set it on the Teams page.` });
    }

    // QA discipline members — issues directly assigned to one of these convert
    // fully at the QA rate; every other issue converts at the Dev rate.
    const qaMembers = await prisma.teamMember.findMany({ where: { team_id: teamId, discipline: 'QA' } });
    const qaNames = new Set(qaMembers.map(m => (m.name || '').trim().toLowerCase()).filter(Boolean));

    const dateRange = jira.getQuarterDateRange(quarter);
    if (!dateRange) return res.status(400).json({ error: `Cannot parse quarter: ${quarter}` });

    const fieldMap = await jira.fetchFieldMap();
    const spField = jira.detectStoryPointsField(fieldMap);
    const epicLinkField = jira.detectEpicLinkField(fieldMap);
    const project = team.jira_project_key;

    // Which project(s) hold PROD items — used to recognise an epic's PROD parent by key.
    // Derived from the planned work items' prod_id values, with an env override / default.
    const prodPrefixes = new Set(
      (process.env.JIRA_PROD_PROJECT_KEY ? [process.env.JIRA_PROD_PROJECT_KEY] : [])
        .concat((Array.isArray(prodKeys) ? prodKeys : []).map(k => String(k).split('-')[0]))
        .map(p => p.trim().toUpperCase())
        .filter(Boolean)
    );
    if (prodPrefixes.size === 0) prodPrefixes.add('PROD');

    // Strict "completed in the quarter": an issue counts as Completed/Cancelled only
    // if it was FINISHED (resolutiondate) within the quarter — not merely updated in it.
    // In Progress = still-open issues that were touched during the quarter.
    // Jira treats a bare end date as 00:00, so make the upper bound inclusive of the last day.
    const endInclusive  = `${dateRange.end} 23:59`;
    const resolvedJql   = `project = "${project}" AND resolutiondate >= "${dateRange.start}" AND resolutiondate <= "${endInclusive}" ORDER BY resolutiondate DESC`;
    // In progress = open issues whose STATUS actually moved during the quarter — so a
    // ticket merely touched to link a test case / add a comment (which only bumps
    // `updated`) is not counted. Falls back to `updated` if a project rejects CHANGED.
    const inProgressJql = `project = "${project}" AND resolution = EMPTY AND status CHANGED DURING ("${dateRange.start}", "${dateRange.end}") ORDER BY updated DESC`;
    const inProgressJqlFallback = `project = "${project}" AND resolution = EMPTY AND updated >= "${dateRange.start}" AND updated <= "${endInclusive}" ORDER BY updated DESC`;

    // parent = team-managed epic link; epicLinkField/customfield_10014 = company-managed Epic Link
    const spFields = [...new Set(['summary', 'status', 'issuetype', 'parent', 'assignee', epicLinkField, 'customfield_10014', spField])];
    // Backstop for very large projects (e.g. high-volume bug projects) so a single
    // fetch can't paginate/fan-out without bound and time out.
    const MAX_ISSUES = 2000;
    const [resolvedIssues, openIssues] = await Promise.all([
      jira.searchJql(resolvedJql, spFields, MAX_ISSUES),
      jira.searchJql(inProgressJql, spFields, MAX_ISSUES)
        .catch(() => jira.searchJql(inProgressJqlFallback, spFields, MAX_ISSUES)),
    ]);
    const truncated = !!(resolvedIssues.truncated || openIssues.truncated);

    const ignoredStatuses = new Set(['to do', 'backlog', 'open', 'new', 'todo']);
    // Cancelled / abandoned work — counts as neither delivered nor in-progress.
    // "Obsolete / Won't Do" is the real Jira status to ignore; the rest are common
    // variants. Overridable via JIRA_EXCLUDED_STATUSES (comma-separated status names).
    const defaultExcluded = [
      "obsolete / won't do", 'obsolete / wont do',
      "won't do", 'wont do', "won't fix", 'wont fix',
      'obsolete', 'cancelled', 'canceled', 'rejected', 'duplicate', 'declined', 'abandoned',
    ];
    const excludedStatuses = new Set(
      process.env.JIRA_EXCLUDED_STATUSES
        ? process.env.JIRA_EXCLUDED_STATUSES.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
        : defaultExcluded
    );

    const statusOf = (i) => (i.fields?.status?.name || '').toLowerCase();
    // Of the issues resolved this quarter: cancelled (excluded status) vs genuinely completed.
    const excludedIssues   = resolvedIssues.filter(i => excludedStatuses.has(statusOf(i)));
    const completedIssues  = resolvedIssues.filter(i => !excludedStatuses.has(statusOf(i)));
    // Open issues touched this quarter, minus backlog/to-do (and any stray excluded status).
    const inProgressIssues = openIssues.filter(i => {
      const s = statusOf(i);
      return !excludedStatuses.has(s) && !ignoredStatuses.has(s);
    });

    const completedJql = resolvedJql;

    const getSP = (issue) => {
      const val = issue.fields?.[spField];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') { const n = parseFloat(val); return isNaN(n) ? 0 : n; }
      return 0;
    };

    const getEpicKey = (issue) =>
      issue.fields?.parent?.key || issue.fields?.[epicLinkField] || issue.fields?.customfield_10014 || null;

    const mapIssue = (issue) => ({
      key: issue.key,
      summary: issue.fields?.summary,
      status: issue.fields?.status?.name,
      issueType: issue.fields?.issuetype?.name,
      storyPoints: getSP(issue),
      epicKey: getEpicKey(issue),
      epicName: issue.fields?.parent?.fields?.summary || null,
      assignee: issue.fields?.assignee?.displayName || null,
    });

    const completed  = completedIssues.map(mapIssue);
    const inProgress = inProgressIssues.map(mapIssue);
    const excluded   = excludedIssues.map(mapIssue);

    // Fetch unique epics to get their name, SP, and PROD parent
    const epicKeys = [...new Set([...resolvedIssues, ...openIssues].map(getEpicKey).filter(Boolean))];
    const epicDetails = {};
    const prefixOf = (key) => (key || '').split('-')[0].toUpperCase();
    // Bounded concurrency: fetching every epic at once on a large project triggers
    // Jira rate limits. Process in small batches instead.
    const EPIC_CONCURRENCY = 8;
    const resolveEpic = async (key) => {
      try {
        const epic = await jira.fetchIssue(key);
        if (!epic) return;
        let prodKey = null, prodName = null;
        const links = epic.fields?.issuelinks || [];
        // Is the thing we grouped under actually an Epic? (A story/sub-task parent is not.)
        const it = epic.fields?.issuetype;
        const isEpic = it?.name === 'Epic' || (typeof it?.hierarchyLevel === 'number' && it.hierarchyLevel >= 1);

        // 1) Scan ALL issue links (both directions) for a linked issue that lives in a
        //    PROD project. Prefer an "implements"-style relationship when several match.
        const candidates = [];
        for (const link of links) {
          const linked = link.outwardIssue || link.inwardIssue;
          if (!linked?.key || !prodPrefixes.has(prefixOf(linked.key))) continue;
          const rel = `${link.type?.outward || ''} ${link.type?.inward || ''}`.toLowerCase();
          candidates.push({ key: linked.key, name: linked.fields?.summary || null, implementsRel: rel.includes('implement') });
        }
        const chosen = candidates.find(c => c.implementsRel) || candidates[0];
        if (chosen) { prodKey = chosen.key; prodName = chosen.name; }

        // 2) Fallback: the epic's parent, if it lives in a PROD project.
        if (!prodKey) {
          const parentKey = epic.fields?.parent?.key || null;
          if (parentKey && prodPrefixes.has(prefixOf(parentKey))) {
            prodKey  = parentKey;
            prodName = epic.fields?.parent?.fields?.summary || null;
          }
        }

        epicDetails[key] = {
          key,
          name: epic.fields?.summary,
          storyPoints: getSP(epic),
          prodKey,
          prodName,
          isEpic,
          // diagnostics: links seen on epics that did NOT resolve to a PROD
          links: prodKey ? undefined : links.map(l => ({
            type: l.type?.name || null,
            key: (l.outwardIssue || l.inwardIssue)?.key || null,
          })),
        };
      } catch {}
    };
    for (let i = 0; i < epicKeys.length; i += EPIC_CONCURRENCY) {
      await Promise.all(epicKeys.slice(i, i + EPIC_CONCURRENCY).map(resolveEpic));
    }

    // Genuine epics that ended up with no PROD link — surfaced so linkage gaps can be diagnosed.
    const unresolvedEpics = Object.values(epicDetails)
      .filter(e => !e.prodKey && e.isEpic)
      .map(e => ({ key: e.key, name: e.name, links: e.links || [] }));

    const UNASSIGNED = 'No epic / unassigned';

    // Build breakdown: group by PROD → Epic.
    // Grouping rules:
    //   - has a PROD link        → group under the PROD
    //   - parent is a real Epic  → group under that Epic
    //   - otherwise (no epic, or "parent" is a story/sub-task) → "unassigned" catch-all
    const buildBreakdown = (issues) => {
      const groups = {};
      issues.forEach(issue => {
        const epic     = issue.epicKey ? epicDetails[issue.epicKey] : null;
        const prodKey  = epic?.prodKey  || null;
        const prodName = epic?.prodName || null;
        const realEpic = !prodKey && !!epic?.isEpic;       // genuine epic, not a story parent
        const epicKey  = (prodKey || realEpic) ? (issue.epicKey || null) : null;
        const epicName = epic?.name || issue.epicName || null;
        const gKey     = prodKey || (realEpic ? epicKey : null) || '__none__';

        if (!groups[gKey]) {
          groups[gKey] = {
            groupKey: gKey,
            isProd: !!prodKey,
            isEpic: realEpic,
            prodKey,
            prodName: prodName || (realEpic ? epicName : null) || UNASSIGNED,
            epics: {},
          };
        }
        const eKey = epicKey || '__none__';
        if (!groups[gKey].epics[eKey]) {
          groups[gKey].epics[eKey] = {
            epicKey,
            epicName: realEpic ? (epicName || 'Epic') : 'No epic',
            count: 0,
            storyPoints: 0,
            devSP: 0,
            qaSP: 0,
          };
        }
        // Issues directly assigned to a QA-discipline member convert fully at the
        // QA rate; every other issue converts at the Dev rate.
        const isQaAssignee = !!issue.assignee && qaNames.has(issue.assignee.trim().toLowerCase());
        groups[gKey].epics[eKey].count++;
        groups[gKey].epics[eKey].storyPoints += issue.storyPoints;
        groups[gKey].epics[eKey].devSP += isQaAssignee ? 0 : issue.storyPoints;
        groups[gKey].epics[eKey].qaSP += isQaAssignee ? issue.storyPoints : 0;
      });

      return Object.values(groups)
        .map(g => ({ ...g, epics: Object.values(g.epics).sort((a, b) => b.storyPoints - a.storyPoints) }))
        .sort((a, b) => {
          if (a.prodName === UNASSIGNED) return 1;
          if (b.prodName === UNASSIGNED) return -1;
          return (a.prodName || '').localeCompare(b.prodName || '');
        });
    };

    // Fetch names for any planned PROD keys not already resolved via epic details
    const resolvedProdKeys = {};
    const knownProdKeys = new Set(Object.values(epicDetails).map(e => e.prodKey).filter(Boolean));
    const unknownProdKeys = (Array.isArray(prodKeys) ? prodKeys : []).filter(k => k && !knownProdKeys.has(k));
    await Promise.all(unknownProdKeys.map(async (key) => {
      try {
        const issue = await jira.fetchIssue(key);
        if (issue) resolvedProdKeys[key] = issue.fields?.summary || key;
      } catch {}
    }));

    res.json({
      data: {
        quarter,
        team: {
          id: team.id,
          name: team.name,
          jira_project_key: project,
          days_per_sp: team.days_per_sp ?? 1,
          qa_days_per_sp: team.qa_days_per_sp ?? 1,
        },
        dateRange,
        storyPointsField: spField,
        epicLinkField,
        prodProjectKeys: [...prodPrefixes],
        unresolvedEpics,
        truncated,
        maxIssues: MAX_ISSUES,
        jiraBaseUrl: process.env.JIRA_BASE_URL || null,
        excludedStatuses: [...excludedStatuses],
        jql: { completed: completedJql, inProgress: inProgressJql },
        epicDetails,
        resolvedProdKeys,
        completed: {
          count: completed.length,
          storyPoints: completed.reduce((sum, i) => sum + i.storyPoints, 0),
          issues: completed,
          byProd: buildBreakdown(completed),
        },
        inProgress: {
          count: inProgress.length,
          storyPoints: inProgress.reduce((sum, i) => sum + i.storyPoints, 0),
          issues: inProgress,
          byProd: buildBreakdown(inProgress),
        },
        excluded: {
          count: excluded.length,
          storyPoints: excluded.reduce((sum, i) => sum + i.storyPoints, 0),
          issues: excluded,
          byProd: buildBreakdown(excluded),
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Freeze a quarter's plan-vs-delivered comparison for a team (one per quarter+team;
// re-finalizing overwrites). Stores the already-computed rows + summary so the
// dedicated review page renders an immutable record without re-querying Jira.
router.post('/saveQuarterlyComparison', requireAuth, async (req, res) => {
  try {
    const { quarter, team_id, team_name, days_per_sp, qa_days_per_sp, jira_base_url, date_start, date_end, has_initial, rows, excluded, summary } = req.body;
    if (!quarter || !team_id || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'quarter, team_id and rows are required' });
    }
    const isAdmin = req.user.role === 'admin';
    const isManager = req.user.role === 'team_manager' && (req.user.managed_team_ids || []).includes(team_id);
    if (!isAdmin && !isManager) {
      return res.status(403).json({ error: 'Not authorized to finalize this team' });
    }
    const data = {
      team_name: team_name || null,
      days_per_sp: typeof days_per_sp === 'number' ? days_per_sp : 1,
      qa_days_per_sp: typeof qa_days_per_sp === 'number' ? qa_days_per_sp : 1,
      jira_base_url: jira_base_url || null,
      date_start: date_start || null,
      date_end: date_end || null,
      has_initial: !!has_initial,
      rows,
      excluded: excluded || null,
      summary: summary || null,
      captured_by_email: req.user.email || null,
      captured_at: new Date(),
    };
    const item = await prisma.quarterlyComparisonSnapshot.upsert({
      where: { quarter_team_id: { quarter, team_id } },
      update: data,
      create: { quarter, team_id, ...data },
    });
    res.json({ data: item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Expose the Jira base URL (and configured flag) so the frontend can build
// clickable links to issues without duplicating JIRA_BASE_URL in a build-time var.
router.post('/getJiraConfig', requireAuth, async (_req, res) => {
  res.json({
    data: {
      jiraBaseUrl: process.env.JIRA_BASE_URL || null,
      configured: jira.isConfigured(),
    },
  });
});

// ── BambooHR: availability sync ──────────────────────────────────────────────

router.post('/getBambooHrConfig', requireAuth, async (_req, res) => {
  res.json({ data: { configured: bamboohr.isConfigured() } });
});

// Employee directory for the member-mapping picker (admin/manager only).
router.post('/getBambooHrDirectory', requireAuth, async (req, res) => {
  try {
    if (!bamboohr.isConfigured()) return res.status(400).json({ error: 'BambooHR not configured (BAMBOOHR_SUBDOMAIN, BAMBOOHR_API_KEY)' });
    if (req.user.role !== 'admin' && req.user.role !== 'team_manager') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const directory = await bamboohr.fetchDirectory();
    res.json({ data: { employees: directory } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Compute available working days for a quarter from BambooHR (weekdays − approved
// time off) and overwrite each mapped member's TeamMemberCapacity for that quarter.
// Run at the start of a quarter to prefill, and again at the end to true-up.
router.post('/syncBambooHrAvailability', requireAuth, async (req, res) => {
  try {
    if (!bamboohr.isConfigured()) return res.status(400).json({ error: 'BambooHR not configured (BAMBOOHR_SUBDOMAIN, BAMBOOHR_API_KEY)' });
    const { teamId, quarter } = req.body;
    if (!teamId || !quarter) return res.status(400).json({ error: 'teamId and quarter are required' });

    const isAdmin = req.user.role === 'admin';
    const isManager = req.user.role === 'team_manager' && (req.user.managed_team_ids || []).includes(teamId);
    if (!isAdmin && !isManager) return res.status(403).json({ error: 'Not authorized to manage this team' });

    const dateRange = jira.getQuarterDateRange(quarter);
    if (!dateRange) return res.status(400).json({ error: `Cannot parse quarter: ${quarter}` });

    const weekdays = bamboohr.countWeekdays(dateRange.start, dateRange.end);
    const offByEmployee = await bamboohr.fetchApprovedTimeOffDays(dateRange.start, dateRange.end);

    const members = await prisma.teamMember.findMany({ where: { team_id: teamId } });
    const results = [];
    for (const m of members) {
      if (!m.bamboohr_id) { results.push({ name: m.name, mapped: false }); continue; }
      const off = offByEmployee[String(m.bamboohr_id)] || 0;
      const workingDays = Math.max(0, Math.round(weekdays - off));
      const existing = await prisma.teamMemberCapacity.findFirst({ where: { team_member_id: m.id, quarter } });
      if (existing) {
        await prisma.teamMemberCapacity.update({ where: { id: existing.id }, data: { working_days: workingDays } });
      } else {
        await prisma.teamMemberCapacity.create({ data: { team_member_id: m.id, quarter, working_days: workingDays } });
      }
      results.push({ name: m.name, mapped: true, offDays: Math.round(off * 10) / 10, workingDays });
    }

    res.json({
      data: {
        quarter,
        dateRange,
        weekdays,
        updated: results.filter(r => r.mapped).length,
        unmapped: results.filter(r => !r.mapped).length,
        members: results,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// Next anniversary of the hire date on/after today (the entitlement renewal anchor).
// Still used for consultant/external policies, whose entitlement genuinely resets on a
// per-employee anniversary rather than the calendar year.
function nextHireAnniversary(hireDate, today) {
  const h = new Date(hireDate);
  if (Number.isNaN(h.getTime())) return null;
  const next = new Date(Date.UTC(today.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate()));
  if (next < today) next.setUTCFullYear(today.getUTCFullYear() + 1);
  return next;
}

// Non-consultant vacation forfeits on Dec 31 each year, except up to this many days which
// carry over into a grace period ending March 31 of the following year (per HR policy).
const NON_CONSULTANT_CARRYOVER_CAP = 10;

// Forfeiture deadline + at-risk amount for non-consultant policies (calendar-year based,
// not hire-date based). Jan–Mar: still in the prior year's grace period, so only the carried
// (capped) amount can be lost, by March 31. Apr–Dec: grace period has lapsed, so anything
// above the cap will be lost at the Dec 31 anchor.
function vacationDeadlineInfo(balance, today) {
  const year = today.getUTCFullYear();
  const inGracePeriod = today.getUTCMonth() <= 2; // Jan, Feb, Mar
  if (inGracePeriod) {
    return {
      deadline: new Date(Date.UTC(year, 2, 31)),
      atRiskAmount: Math.min(balance, NON_CONSULTANT_CARRYOVER_CAP),
    };
  }
  return {
    deadline: new Date(Date.UTC(year, 11, 31)),
    atRiskAmount: Math.max(0, balance - NON_CONSULTANT_CARRYOVER_CAP),
  };
}

router.post('/getVacationRisk', async (req, res) => {
  if (!bamboohr.isConfigured()) return res.json({ data: { members: [] } });
  const { teamId } = req.body;
  if (!teamId) return res.status(400).json({ error: 'teamId required' });
  try {
    const members = await prisma.teamMember.findMany({
      where: { team_id: teamId, bamboohr_id: { not: null } },
      select: { id: true, name: true, bamboohr_id: true },
    });
    const bamboohrIds = members.map(m => m.bamboohr_id).filter(Boolean);
    if (bamboohrIds.length === 0) return res.json({ data: { members: [] } });
    const balances = await bamboohr.fetchVacationBalances(bamboohrIds);
    const today = new Date();
    const result = members.flatMap(member => {
      const bal = balances[member.bamboohr_id];
      if (!bal) return [];
      const { balance, hireDate, policyName } = bal;
      const isConsultant = bamboohr.CONSULTANT_POLICY_RE.test(policyName || '');

      let renewal, atRiskAmount, deadlineType;
      if (isConsultant) {
        renewal = hireDate ? nextHireAnniversary(hireDate, today) : null;
        atRiskAmount = balance >= 10 ? balance : 0;
        deadlineType = 'renewal';
      } else {
        ({ deadline: renewal, atRiskAmount } = vacationDeadlineInfo(balance, today));
        deadlineType = 'forfeiture';
      }
      const renewalDate = renewal ? renewal.toISOString().slice(0, 10) : null;
      const daysUntilRenewal = renewal
        ? Math.ceil((renewal - today) / (1000 * 60 * 60 * 24))
        : null;
      const atRisk = atRiskAmount > 0 && daysUntilRenewal !== null && daysUntilRenewal <= 90;
      return [{ memberId: member.id, memberName: member.name, balance: Math.round(balance * 10) / 10, hireDate, renewalDate, daysUntilRenewal, policyName, atRisk, deadlineType }];
    });
    result.sort((a, b) => b.balance - a.balance);
    res.json({ data: { members: result } });
  } catch (err) {
    console.error('[vacationRisk] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports._internal = { vacationDeadlineInfo, nextHireAnniversary };
