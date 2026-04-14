const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function canManageTeam(user, teamId) {
  if (user.role === 'admin') return true;
  if (user.role === 'team_manager') {
    return (user.managed_team_ids || []).includes(teamId);
  }
  return false;
}

// List snapshots filtered by quarter and/or team_id
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = {};
    if (req.query.quarter) where.quarter = req.query.quarter;
    if (req.query.team_id) where.team_id = req.query.team_id;
    const items = await prisma.quarterlyPlanSnapshot.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a snapshot
router.post('/', requireAuth, async (req, res) => {
  try {
    const { quarter, team_id, team_name, label, note, allocations } = req.body;
    if (!quarter || !team_id || !label) {
      return res.status(400).json({ error: 'quarter, team_id, and label are required' });
    }
    if (!canManageTeam(req.user, team_id)) {
      return res.status(403).json({ error: 'Not authorized to manage this team' });
    }
    const item = await prisma.quarterlyPlanSnapshot.create({
      data: {
        quarter,
        team_id,
        team_name: team_name || null,
        label,
        note: note || null,
        created_by_email: req.user.email || null,
        allocations: allocations || [],
      },
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mark a snapshot as the "initial plan" for that team+quarter (unsets all others)
router.patch('/:id/set-initial-plan', requireAuth, async (req, res) => {
  try {
    const snapshot = await prisma.quarterlyPlanSnapshot.findUnique({ where: { id: req.params.id } });
    if (!snapshot) return res.status(404).json({ error: 'Not found' });
    if (!canManageTeam(req.user, snapshot.team_id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    await prisma.$transaction([
      prisma.quarterlyPlanSnapshot.updateMany({
        where: { team_id: snapshot.team_id, quarter: snapshot.quarter },
        data: { is_initial_plan: false },
      }),
      prisma.quarterlyPlanSnapshot.update({
        where: { id: req.params.id },
        data: { is_initial_plan: true },
      }),
    ]);
    const updated = await prisma.quarterlyPlanSnapshot.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a snapshot (admin or manager of that team)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const snapshot = await prisma.quarterlyPlanSnapshot.findUnique({ where: { id: req.params.id } });
    if (!snapshot) return res.status(404).json({ error: 'Not found' });
    if (!canManageTeam(req.user, snapshot.team_id)) {
      return res.status(403).json({ error: 'Not authorized to delete this snapshot' });
    }
    await prisma.quarterlyPlanSnapshot.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
