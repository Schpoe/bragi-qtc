const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const importDir = '/import';

// CSV parser that handles quoted fields and escaped quotes ("")
function parseCSV(content) {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let field = '';
        i++;
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else { field += line[i++]; }
        }
        fields.push(field);
        if (line[i] === ',') i++;
      } else {
        const end = line.indexOf(',', i);
        if (end === -1) { fields.push(line.slice(i)); break; }
        fields.push(line.slice(i, end));
        i = end + 1;
      }
    }
    result.push(fields);
  }
  return result;
}

function idx(headers, col) { return headers.indexOf(col); }
function parseDate(val) { if (!val || !val.trim()) return null; const d = new Date(val); return isNaN(d.getTime()) ? null : d; }
function parseArr(val) { if (!val || val.trim() === '' || val === '[]') return []; try { return JSON.parse(val); } catch { return []; } }
function parseIntVal(val, def = 0) { const n = parseInt(val, 10); return isNaN(n) ? def : n; }
function parseBool(val) { return val && val.toLowerCase() === 'true'; }

async function importTeams() {
  const rows = parseCSV(fs.readFileSync(path.join(importDir, 'Team_export.csv'), 'utf8'));
  // Header row is malformed (tab-separated inside quotes); column order in data rows is:
  // name, color, description, id, created_date, updated_date, created_by_id, created_by, is_sample
  let count = 0;
  for (const row of rows.slice(1)) {
    if (!row[3]) continue;
    await prisma.team.upsert({
      where: { id: row[3] },
      update: { name: row[0], color: row[1] || null, description: row[2] || null },
      create: {
        id: row[3],
        name: row[0],
        color: row[1] || null,
        description: row[2] || null,
        created_at: parseDate(row[4]) || new Date(),
        updated_at: parseDate(row[5]) || new Date(),
      },
    });
    count++;
  }
  console.log(`Imported ${count} teams`);
}

async function importWorkAreaTypes() {
  const rows = parseCSV(fs.readFileSync(path.join(importDir, 'WorkAreaType_export.csv'), 'utf8'));
  const h = rows[0];
  let count = 0;
  for (const row of rows.slice(1)) {
    if (!row[idx(h, 'id')]) continue;
    await prisma.workAreaType.upsert({
      where: { id: row[idx(h, 'id')] },
      update: {},
      create: {
        id: row[idx(h, 'id')],
        name: row[idx(h, 'name')],
        created_at: parseDate(row[idx(h, 'created_date')]) || new Date(),
        updated_at: parseDate(row[idx(h, 'updated_date')]) || new Date(),
      },
    });
    count++;
  }
  console.log(`Imported ${count} work area types`);
}

async function importTeamMembers() {
  const rows = parseCSV(fs.readFileSync(path.join(importDir, 'TeamMember_export.csv'), 'utf8'));
  const h = rows[0];
  let count = 0;
  for (const row of rows.slice(1)) {
    if (!row[idx(h, 'id')]) continue;
    // availability_percent (0-100) → sprint_days: 100% = 10 days, rounded
    const availabilityPercent = parseIntVal(row[idx(h, 'availability_percent')], 100);
    const sprintDays = Math.round(availabilityPercent / 10);
    await prisma.teamMember.upsert({
      where: { id: row[idx(h, 'id')] },
      update: {},
      create: {
        id: row[idx(h, 'id')],
        team_id: row[idx(h, 'team_id')],
        name: row[idx(h, 'name')],
        discipline: row[idx(h, 'discipline')] || '',
        sprint_days: sprintDays,
        created_at: parseDate(row[idx(h, 'created_date')]) || new Date(),
        updated_at: parseDate(row[idx(h, 'updated_date')]) || new Date(),
      },
    });
    count++;
  }
  console.log(`Imported ${count} team members`);
}

async function importWorkAreas() {
  const rows = parseCSV(fs.readFileSync(path.join(importDir, 'WorkArea_export.csv'), 'utf8'));
  const h = rows[0];
  let count = 0;
  for (const row of rows.slice(1)) {
    if (!row[idx(h, 'id')]) continue;
    await prisma.workArea.upsert({
      where: { id: row[idx(h, 'id')] },
      update: {},
      create: {
        id: row[idx(h, 'id')],
        name: row[idx(h, 'name')],
        color: row[idx(h, 'color')] || null,
        type: row[idx(h, 'type')] || null,
        leading_team_id: row[idx(h, 'leading_team_id')] || null,
        supporting_team_ids: parseArr(row[idx(h, 'supporting_team_ids')]),
        prod_id: row[idx(h, 'prod_id')] || null,
        jira_key: row[idx(h, 'jira_key')] || null,
        jira_status: row[idx(h, 'jira_status')] || null,
        jira_progress: parseIntVal(row[idx(h, 'jira_progress')], 0),
        last_synced: parseDate(row[idx(h, 'last_synced')]),
        linked_epic_keys: parseArr(row[idx(h, 'linked_epic_keys')]),
        created_at: parseDate(row[idx(h, 'created_date')]) || new Date(),
        updated_at: parseDate(row[idx(h, 'updated_date')]) || new Date(),
      },
    });
    count++;
  }
  console.log(`Imported ${count} work areas`);
}

async function importSprints() {
  const rows = parseCSV(fs.readFileSync(path.join(importDir, 'Sprint_export.csv'), 'utf8'));
  const h = rows[0];
  let count = 0;
  for (const row of rows.slice(1)) {
    if (!row[idx(h, 'id')]) continue;
    await prisma.sprint.upsert({
      where: { id: row[idx(h, 'id')] },
      update: {},
      create: {
        id: row[idx(h, 'id')],
        name: row[idx(h, 'name')],
        team_id: row[idx(h, 'team_id')] || null,
        quarter: row[idx(h, 'quarter')] || '',
        start_date: parseDate(row[idx(h, 'start_date')]),
        end_date: parseDate(row[idx(h, 'end_date')]),
        is_cross_team: parseBool(row[idx(h, 'is_cross_team')]),
        is_template: false,
        relevant_work_area_ids: parseArr(row[idx(h, 'relevant_work_area_ids')]),
        created_at: parseDate(row[idx(h, 'created_date')]) || new Date(),
        updated_at: parseDate(row[idx(h, 'updated_date')]) || new Date(),
      },
    });
    count++;
  }
  console.log(`Imported ${count} sprints`);
}

async function importAllocations(memberSprintDays) {
  const rows = parseCSV(fs.readFileSync(path.join(importDir, 'Allocation_export.csv'), 'utf8'));
  const h = rows[0];
  let count = 0;
  for (const row of rows.slice(1)) {
    if (!row[idx(h, 'id')]) continue;
    const memberId = row[idx(h, 'team_member_id')];
    const sprintDays = memberSprintDays[memberId] ?? 10;
    const percent = parseIntVal(row[idx(h, 'percent')], 0);
    const days = Math.round(percent * sprintDays / 100);
    await prisma.allocation.upsert({
      where: { id: row[idx(h, 'id')] },
      update: {},
      create: {
        id: row[idx(h, 'id')],
        sprint_id: row[idx(h, 'sprint_id')],
        team_member_id: memberId,
        work_area_id: row[idx(h, 'work_area_id')],
        days,
        created_at: parseDate(row[idx(h, 'created_date')]) || new Date(),
        updated_at: parseDate(row[idx(h, 'updated_date')]) || new Date(),
      },
    });
    count++;
  }
  console.log(`Imported ${count} allocations`);
}

// Default quarterly working days used when no TeamMemberCapacity record exists.
// Adjust if your quarters have a different number of working days.
const DEFAULT_QUARTERLY_DAYS = 60;

async function importQuarterlyAllocations(memberSprintDays) {
  const rows = parseCSV(fs.readFileSync(path.join(importDir, 'QuarterlyAllocation_export.csv'), 'utf8'));
  const h = rows[0];
  let count = 0;
  for (const row of rows.slice(1)) {
    if (!row[idx(h, 'id')]) continue;
    const memberId = row[idx(h, 'team_member_id')];
    // Use the member's sprint_days proportion to estimate quarterly days,
    // falling back to DEFAULT_QUARTERLY_DAYS for a fully available member.
    const sprintDays = memberSprintDays[memberId] ?? 10;
    const quarterlyDays = Math.round(DEFAULT_QUARTERLY_DAYS * sprintDays / 10);
    const percent = parseIntVal(row[idx(h, 'percent')], 0);
    const days = Math.round(percent * quarterlyDays / 100);
    await prisma.quarterlyAllocation.upsert({
      where: { id: row[idx(h, 'id')] },
      update: {},
      create: {
        id: row[idx(h, 'id')],
        quarter: row[idx(h, 'quarter')],
        team_member_id: memberId,
        work_area_id: row[idx(h, 'work_area_id')],
        days,
        created_at: parseDate(row[idx(h, 'created_date')]) || new Date(),
        updated_at: parseDate(row[idx(h, 'updated_date')]) || new Date(),
      },
    });
    count++;
  }
  console.log(`Imported ${count} quarterly allocations`);
}

async function importQuarterlyWorkAreaSelections() {
  const rows = parseCSV(fs.readFileSync(path.join(importDir, 'QuarterlyWorkAreaSelection_export.csv'), 'utf8'));
  const h = rows[0];
  let count = 0;
  for (const row of rows.slice(1)) {
    if (!row[idx(h, 'id')]) continue;
    await prisma.quarterlyWorkAreaSelection.upsert({
      where: { id: row[idx(h, 'id')] },
      update: {},
      create: {
        id: row[idx(h, 'id')],
        quarter: row[idx(h, 'quarter')],
        team_id: row[idx(h, 'team_id')],
        work_area_ids: parseArr(row[idx(h, 'work_area_ids')]),
        created_at: parseDate(row[idx(h, 'created_date')]) || new Date(),
        updated_at: parseDate(row[idx(h, 'updated_date')]) || new Date(),
      },
    });
    count++;
  }
  console.log(`Imported ${count} quarterly work area selections`);
}

async function main() {
  console.log('Starting Base44 data migration...\n');
  await importTeams();
  await importWorkAreaTypes();
  await importTeamMembers();
  await importWorkAreas();
  await importSprints();

  // Build member → sprint_days map so allocation importers can convert percent → days
  const members = await prisma.teamMember.findMany({ select: { id: true, sprint_days: true } });
  const memberSprintDays = Object.fromEntries(members.map(m => [m.id, m.sprint_days]));

  await importAllocations(memberSprintDays);
  await importQuarterlyAllocations(memberSprintDays);
  await importQuarterlyWorkAreaSelections();
  console.log('\nMigration complete!');
}

main()
  .catch(e => { console.error('Migration failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
