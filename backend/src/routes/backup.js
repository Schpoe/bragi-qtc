const express = require('express');
const prisma = require('../prisma');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Tables to export/import, in dependency order (parents before children)
const TABLES = [
  'team',
  'teamMember',
  'teamMemberCapacity',
  'workAreaType',
  'workArea',
  'quarterlyAllocation',
  'quarterlyWorkAreaSelection',
  'quarterlyPlanHistory',
  'quarterlyPlanSnapshot',
  'user',
  'passwordResetToken',
  'jiraSyncHistory',
];

// GET /api/backup — download a full JSON backup
router.get('/', requireAdmin, async (_req, res) => {
  try {
    const data = {};
    for (const table of TABLES) {
      if (!prisma[table]) { throw new Error(`prisma.${table} is undefined`); }
      data[table] = await prisma[table].findMany();
    }
    const payload = JSON.stringify({ version: 1, exported_at: new Date().toISOString(), data }, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="bragi-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.send(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Backup failed: ' + err.message });
  }
});

// POST /api/backup/restore — restore from a JSON backup (replaces all data)
router.post('/restore', requireAdmin, async (req, res) => {
  try {
    const { version, data } = req.body;
    if (!version || !data) {
      return res.status(400).json({ message: 'Invalid backup file' });
    }

    await prisma.$transaction(async (tx) => {
      // Delete in reverse dependency order to avoid FK constraint issues
      for (const table of [...TABLES].reverse()) {
        await tx[table].deleteMany();
      }
      // Re-insert in forward order
      for (const table of TABLES) {
        const rows = data[table];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        for (const row of rows) {
          await tx[table].create({ data: row });
        }
      }
    });

    res.json({ ok: true, message: 'Restore complete' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Restore failed: ' + err.message });
  }
});

module.exports = router;
