const express = require('express');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function canManageTeam(user, teamId) {
  if (user.role === 'admin') return true;
  if (user.role === 'team_manager') return (user.managed_team_ids || []).includes(teamId);
  return false;
}

// List frozen comparison snapshots, optionally filtered by quarter and/or team_id.
router.get('/', requireAuth, async (req, res) => {
  try {
    const where = {};
    if (req.query.quarter) where.quarter = req.query.quarter;
    if (req.query.team_id) where.team_id = req.query.team_id;
    const items = await prisma.quarterlyComparisonSnapshot.findMany({
      where,
      orderBy: [{ quarter: 'desc' }, { team_name: 'asc' }],
    });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const item = await prisma.quarterlyComparisonSnapshot.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a frozen snapshot (admin or manager of that team).
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const snap = await prisma.quarterlyComparisonSnapshot.findUnique({ where: { id: req.params.id } });
    if (!snap) return res.status(404).json({ error: 'Not found' });
    if (!canManageTeam(req.user, snap.team_id)) {
      return res.status(403).json({ error: 'Not authorized to delete this snapshot' });
    }
    await prisma.quarterlyComparisonSnapshot.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
