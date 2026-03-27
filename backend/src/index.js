require('dotenv').config();

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const teamRoutes = require('./routes/teams');
const teamMemberRoutes = require('./routes/team-members');
const workAreaRoutes = require('./routes/work-areas');
const workAreaTypeRoutes = require('./routes/work-area-types');
const sprintRoutes = require('./routes/sprints');
const allocationRoutes = require('./routes/allocations');
const quarterlyAllocationRoutes = require('./routes/quarterly-allocations');
const quarterlyWorkAreaSelectionRoutes = require('./routes/quarterly-work-area-selections');
const quarterlyPlanHistoryRoutes = require('./routes/quarterly-plan-history');
const jiraSyncHistoryRoutes = require('./routes/jira-sync-history');
const functionsRoutes = require('./routes/functions');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/team-members', teamMemberRoutes);
app.use('/api/work-areas', workAreaRoutes);
app.use('/api/work-area-types', workAreaTypeRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/quarterly-allocations', quarterlyAllocationRoutes);
app.use('/api/quarterly-work-area-selections', quarterlyWorkAreaSelectionRoutes);
app.use('/api/quarterly-plan-history', quarterlyPlanHistoryRoutes);
app.use('/api/jira-sync-history', jiraSyncHistoryRoutes);
app.use('/api/functions', functionsRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
