const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const jira = require('../lib/jira');

const router = express.Router();

// Create a user with an initial password (replaces inviteUserWithTeams)
router.post('/inviteUserWithTeams', requireAdmin, async (req, res) => {
  try {
    const { email, role, managed_team_ids = [], initial_password } = req.body;
    if (!email || !initial_password) {
      return res.status(400).json({ error: 'email and initial_password are required' });
    }
    const password_hash = await bcrypt.hash(initial_password, 10);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), role: role || 'viewer', managed_team_ids, password_hash },
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

module.exports = router;
