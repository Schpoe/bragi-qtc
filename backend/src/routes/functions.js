const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const jira = require('../lib/jira');

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

// Delete allocations referencing missing members/sprints/work areas
router.post('/cleanupOrphanedAllocations', requireAdmin, async (_req, res) => {
  try {
    const [allocations, members, workAreas] = await Promise.all([
      prisma.allocation.findMany(),
      prisma.teamMember.findMany({ select: { id: true } }),
      prisma.workArea.findMany({ select: { id: true } }),
    ]);

    const memberIds = new Set(members.map(m => m.id));
    const workAreaIds = new Set(workAreas.map(w => w.id));

    const orphaned = allocations.filter(
      a => !memberIds.has(a.team_member_id) || !workAreaIds.has(a.work_area_id)
    );

    await Promise.all(orphaned.map(a => prisma.allocation.delete({ where: { id: a.id } })));

    res.json({ data: { success: true, deletedCount: orphaned.length, message: `Deleted ${orphaned.length} orphaned allocations` } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Comprehensive orphan cleanup
router.post('/cleanupAllOrphans', requireAdmin, async (_req, res) => {
  try {
    const summary = await prisma.$transaction(async (tx) => {
      const [teams, teamMembers, sprints, allocations, workAreas] = await Promise.all([
        tx.team.findMany({ select: { id: true } }),
        tx.teamMember.findMany(),
        tx.sprint.findMany(),
        tx.allocation.findMany(),
        tx.workArea.findMany({ select: { id: true } }),
      ]);

      const teamIds = new Set(teams.map(t => t.id));
      const workAreaIds = new Set(workAreas.map(w => w.id));
      const result = { orphanedMembers: 0, orphanedSprints: 0, orphanedAllocations: 0, orphanedWorkAreas: 0 };

      // 1. Orphaned team members
      const orphanedMembers = teamMembers.filter(m => m.team_id && !teamIds.has(m.team_id));
      await Promise.all(orphanedMembers.map(m => tx.teamMember.delete({ where: { id: m.id } })));
      result.orphanedMembers = orphanedMembers.length;

      // 2. Orphaned sprints (non-cross-team with missing team)
      const orphanedSprints = sprints.filter(s => !s.is_cross_team && s.team_id && !teamIds.has(s.team_id));
      await Promise.all(orphanedSprints.map(s => tx.sprint.delete({ where: { id: s.id } })));
      result.orphanedSprints = orphanedSprints.length;

      const remainingMemberIds = new Set(orphanedMembers.map(m => m.id));
      const remainingSprintIds = new Set(orphanedSprints.map(s => s.id));

      // 3. Orphaned allocations
      const orphanedAllocations = allocations.filter(
        a => remainingMemberIds.has(a.team_member_id) ||
             remainingSprintIds.has(a.sprint_id) ||
             !workAreaIds.has(a.work_area_id)
      );
      await Promise.all(orphanedAllocations.map(a => tx.allocation.delete({ where: { id: a.id } })));
      result.orphanedAllocations = orphanedAllocations.length;

      // 4. Work areas with non-existent leading teams
      const allWorkAreas = await tx.workArea.findMany();
      const orphanedWorkAreas = allWorkAreas.filter(w => w.leading_team_id && !teamIds.has(w.leading_team_id));
      await Promise.all(orphanedWorkAreas.map(w => tx.workArea.delete({ where: { id: w.id } })));
      result.orphanedWorkAreas = orphanedWorkAreas.length;

      return result;
    });

    const totalDeleted = Object.values(summary).reduce((a, b) => a + b, 0);
    res.json({ data: { success: true, totalDeleted, summary } });
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
    const customFieldNames = Object.keys(fieldMap)
      .filter(name => fieldMap[name].startsWith('customfield_'))
      .sort();
    return res.json({ data: { ok: true, fieldCount: Object.keys(fieldMap).length, baseUrl: process.env.JIRA_BASE_URL, customFieldNames } });
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

    const issues = await jira.searchJql(jql);
    logs.push(`JQL returned ${issues.length} issue(s)`);

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

// Fetch quarterly Jira actuals for a team (completed + in-progress issues)
router.post('/fetchQuarterlyJiraActuals', requireAuth, async (req, res) => {
  try {
    if (!jira.isConfigured()) {
      return res.status(400).json({ error: 'Jira not configured (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)' });
    }
    const { teamId, quarter } = req.body;
    if (!teamId || !quarter) {
      return res.status(400).json({ error: 'teamId and quarter are required' });
    }

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (!team.jira_project_key) {
      return res.status(400).json({ error: `Team "${team.name}" has no Jira project key. Set it on the Teams page.` });
    }

    const dateRange = jira.getQuarterDateRange(quarter);
    if (!dateRange) return res.status(400).json({ error: `Cannot parse quarter: ${quarter}` });

    const fieldMap = await jira.fetchFieldMap();
    const spField = jira.detectStoryPointsField(fieldMap);
    const project = team.jira_project_key;
    console.log(`[jira] using SP field: ${spField}, project: ${project}, range: ${dateRange.start} → ${dateRange.end}`);

    // All issues touched during the quarter — classify by status on our side
    const allJql = `project = "${project}" AND updated >= "${dateRange.start}" AND updated <= "${dateRange.end}" ORDER BY updated DESC`;

    // customfield_10014 = Epic Link (old-style company-managed projects)
    const spFields = ['summary', 'status', 'issuetype', 'parent', 'customfield_10014', spField];
    const allIssues = await jira.searchJql(allJql, spFields);
    console.log(`[jira] fetchQuarterlyJiraActuals: ${allIssues.length} issues for ${project} in ${quarter}`);

    const completedStatuses = new Set(['done', 'closed', 'resolved', 'released', 'complete', 'completed']);
    const ignoredStatuses   = new Set(['to do', 'backlog', 'open', 'new', 'todo']);

    const completedIssues  = allIssues.filter(i => completedStatuses.has((i.fields?.status?.name || '').toLowerCase()));
    const inProgressIssues = allIssues.filter(i => {
      const s = (i.fields?.status?.name || '').toLowerCase();
      return !completedStatuses.has(s) && !ignoredStatuses.has(s);
    });

    const completedJql  = allJql;
    const inProgressJql = allJql;

    const getSP = (issue) => {
      const val = issue.fields?.[spField];
      if (typeof val === 'number') return val;
      if (typeof val === 'string') { const n = parseFloat(val); return isNaN(n) ? 0 : n; }
      return 0;
    };

    const getEpicKey = (issue) =>
      issue.fields?.parent?.key || issue.fields?.customfield_10014 || null;

    const mapIssue = (issue) => ({
      key: issue.key,
      summary: issue.fields?.summary,
      status: issue.fields?.status?.name,
      issueType: issue.fields?.issuetype?.name,
      storyPoints: getSP(issue),
      epicKey: getEpicKey(issue),
      epicName: issue.fields?.parent?.fields?.summary || null,
    });

    const completed  = completedIssues.map(mapIssue);
    const inProgress = inProgressIssues.map(mapIssue);

    // Fetch unique epics to get their name, SP, and PROD parent
    const epicKeys = [...new Set(allIssues.map(getEpicKey).filter(Boolean))];
    console.log(`[jira] fetching ${epicKeys.length} unique epics for PROD/SP resolution`);
    const epicDetails = {};
    await Promise.all(epicKeys.map(async (key) => {
      try {
        const epic = await jira.fetchIssue(key);
        if (epic) {
          epicDetails[key] = {
            key,
            name: epic.fields?.summary,
            storyPoints: getSP(epic),
            prodKey: epic.fields?.parent?.key || epic.fields?.customfield_10014 || null,
            prodName: epic.fields?.parent?.fields?.summary || null,
          };
        }
      } catch {}
    }));
    console.log(`[jira] resolved ${Object.keys(epicDetails).length} epics`);

    // Build breakdown: group by PROD → Epic
    // SP is taken from the Epic (not individual issues) since that's where it's stored
    const buildBreakdown = (issues) => {
      const groups = {};
      issues.forEach(issue => {
        const epic     = issue.epicKey ? epicDetails[issue.epicKey] : null;
        const epicKey  = issue.epicKey || null;
        const epicName = epic?.name || issue.epicName || null;
        const prodKey  = epic?.prodKey  || null;
        const prodName = epic?.prodName || null;
        const gKey     = prodKey || epicKey || '__none__';

        if (!groups[gKey]) {
          groups[gKey] = {
            prodKey,
            prodName: prodName || (epicKey && !prodKey ? epicName : null) || 'Not assigned to PROD',
            epics: {},
          };
        }
        const eKey = epicKey || '__none__';
        if (!groups[gKey].epics[eKey]) {
          const epicSP = epic ? epic.storyPoints : 0;
          groups[gKey].epics[eKey] = {
            epicKey,
            epicName: epicName || 'No Epic',
            count: 0,
            // SP from epic counted once per epic (not summed per issue)
            storyPoints: epicSP,
          };
        }
        groups[gKey].epics[eKey].count++;
      });

      return Object.values(groups)
        .map(g => ({ ...g, epics: Object.values(g.epics).sort((a, b) => b.storyPoints - a.storyPoints) }))
        .sort((a, b) => {
          if (a.prodName === 'Not assigned to PROD') return 1;
          if (b.prodName === 'Not assigned to PROD') return -1;
          return (a.prodName || '').localeCompare(b.prodName || '');
        });
    };

    res.json({
      data: {
        quarter,
        team: { id: team.id, name: team.name, jira_project_key: project },
        dateRange,
        storyPointsField: spField,
        jql: { completed: completedJql, inProgress: inProgressJql },
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
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
