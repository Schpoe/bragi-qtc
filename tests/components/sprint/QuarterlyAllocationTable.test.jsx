import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuarterlyAllocationTable from '@/components/sprint/QuarterlyAllocationTable';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/utils', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/table', () => ({
  Table: ({ children }) => <table>{children}</table>,
  TableHeader: ({ children }) => <thead>{children}</thead>,
  TableBody: ({ children }) => <tbody>{children}</tbody>,
  TableRow: ({ children, className }) => <tr className={className}>{children}</tr>,
  TableHead: ({ children, className, colSpan, rowSpan }) => (
    <th className={className} colSpan={colSpan} rowSpan={rowSpan}>{children}</th>
  ),
  TableCell: ({ children, className }) => <td className={className}>{children}</td>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, variant, size, className }) => (
    <button onClick={onClick} className={className}>{children}</button>
  ),
}));

vi.mock('@/components/sprint/AllocationCell', () => ({
  default: ({ value, onChange }) => (
    <input
      aria-label="allocation"
      type="number"
      defaultValue={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ),
}));

vi.mock('@/components/sprint/QuarterlyAllocationDialog', () => ({
  default: ({ open, onOpenChange, onConfirm }) => (
    open ? <div data-testid="dialog">
      <button onClick={() => onOpenChange(false)}>Close</button>
    </div> : null
  ),
}));

vi.mock('@/components/shared/EmptyState', () => ({
  default: ({ title, description }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock('@/components/shared/DisciplineBadge.jsx', () => ({
  default: ({ discipline }) => <span>{discipline}</span>,
}));

vi.mock('../shared/DisciplineBadge.jsx', () => ({
  default: ({ discipline }) => <span>{discipline}</span>,
}));

const adminUser = { role: 'admin', managed_team_ids: ['team-1'] };
const viewerUser = { role: 'viewer', managed_team_ids: [] };

vi.mock('@/lib/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/permissions', async (importOriginal) => {
  const actual = await importOriginal();
  return actual;
});

import { useAuth } from '@/lib/AuthContext';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const teamId = 'team-1';
const quarter = 'Q1 2025';

const members = [
  { id: 'member-1', name: 'Alice', discipline: 'Engineering', team_id: teamId },
  { id: 'member-2', name: 'Bob', discipline: 'Design', team_id: teamId },
];

const workAreas = [
  { id: 'wa-leading', name: 'Feature Work', color: '#3b82f6', leading_team_id: teamId, supporting_team_ids: [], is_cross_team: false },
  { id: 'wa-supporting', name: 'Platform', color: '#f59e0b', leading_team_id: 'team-2', supporting_team_ids: [teamId], is_cross_team: false },
  { id: 'wa-other', name: 'Ops', color: '#6b7280', leading_team_id: 'team-3', supporting_team_ids: [], is_cross_team: false },
];

const selectedWorkAreaIds = new Set(['wa-leading', 'wa-supporting', 'wa-other']);

const allocations = [
  { id: 'a1', team_member_id: 'member-1', quarter, work_area_id: 'wa-leading', percent: 50 },
  { id: 'a2', team_member_id: 'member-1', quarter, work_area_id: 'wa-supporting', percent: 30 },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('QuarterlyAllocationTable', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: adminUser });
  });

  it('renders member names when work items are selected', () => {
    render(
      <QuarterlyAllocationTable
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        quarter={quarter}
        onAllocationChange={() => {}}
        selectedTeamId={teamId}
        initialSelectedWorkAreaIds={selectedWorkAreaIds}
      />
    );
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
  });

  it('renders work area column headers for selected work items', () => {
    render(
      <QuarterlyAllocationTable
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        quarter={quarter}
        onAllocationChange={() => {}}
        selectedTeamId={teamId}
        initialSelectedWorkAreaIds={selectedWorkAreaIds}
      />
    );
    expect(screen.getAllByText('Feature Work').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Platform').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ops').length).toBeGreaterThan(0);
  });

  it('shows group headers Leading / Supporting / Other when multiple groups exist', () => {
    render(
      <QuarterlyAllocationTable
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        quarter={quarter}
        onAllocationChange={() => {}}
        selectedTeamId={teamId}
        initialSelectedWorkAreaIds={selectedWorkAreaIds}
      />
    );
    expect(screen.getAllByText('Leading').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Supporting').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Other').length).toBeGreaterThan(0);
  });

  it('"Other" work items appear in the table (key regression: was always hidden)', () => {
    render(
      <QuarterlyAllocationTable
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        quarter={quarter}
        onAllocationChange={() => {}}
        selectedTeamId={teamId}
        initialSelectedWorkAreaIds={selectedWorkAreaIds}
      />
    );
    // 'Ops' belongs to team-3 (neither leading nor supporting for team-1)
    expect(screen.getAllByText('Ops').length).toBeGreaterThan(0);
  });

  it('shows editable inputs for admin', () => {
    render(
      <QuarterlyAllocationTable
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        quarter={quarter}
        onAllocationChange={() => {}}
        selectedTeamId={teamId}
        initialSelectedWorkAreaIds={selectedWorkAreaIds}
      />
    );
    const inputs = screen.getAllByLabelText('allocation');
    // desktop + mobile = 2 × (2 members × 3 work areas) = 12
    expect(inputs).toHaveLength(12);
  });

  it('shows read-only percent values for viewer (no editable inputs)', () => {
    useAuth.mockReturnValue({ user: viewerUser });
    render(
      <QuarterlyAllocationTable
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        quarter={quarter}
        onAllocationChange={() => {}}
        selectedTeamId={teamId}
        initialSelectedWorkAreaIds={selectedWorkAreaIds}
      />
    );
    expect(screen.queryAllByLabelText('allocation')).toHaveLength(0);
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
  });

  it('shows empty state when no work items are selected', () => {
    render(
      <QuarterlyAllocationTable
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        quarter={quarter}
        onAllocationChange={() => {}}
        selectedTeamId={teamId}
        initialSelectedWorkAreaIds={new Set()}
      />
    );
    expect(screen.getByText('No work items selected')).toBeInTheDocument();
  });

  it('shows empty state when there are no members', () => {
    render(
      <QuarterlyAllocationTable
        members={[]}
        workAreas={workAreas}
        allocations={[]}
        quarter={quarter}
        onAllocationChange={() => {}}
        selectedTeamId={teamId}
        initialSelectedWorkAreaIds={selectedWorkAreaIds}
      />
    );
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('shows "Select Work Items" button for admin when no items selected', () => {
    render(
      <QuarterlyAllocationTable
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        quarter={quarter}
        onAllocationChange={() => {}}
        selectedTeamId={teamId}
        initialSelectedWorkAreaIds={new Set()}
      />
    );
    expect(screen.getByText('Select Work Items')).toBeInTheDocument();
  });

  it('does not show "Select Work Items" button for viewer', () => {
    useAuth.mockReturnValue({ user: viewerUser });
    render(
      <QuarterlyAllocationTable
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        quarter={quarter}
        onAllocationChange={() => {}}
        selectedTeamId={teamId}
        initialSelectedWorkAreaIds={new Set()}
      />
    );
    expect(screen.queryByText('Select Work Items')).not.toBeInTheDocument();
  });

  it('opens the dialog when "Select Work Items" is clicked', () => {
    render(
      <QuarterlyAllocationTable
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        quarter={quarter}
        onAllocationChange={() => {}}
        selectedTeamId={teamId}
        initialSelectedWorkAreaIds={new Set()}
      />
    );
    fireEvent.click(screen.getByText('Select Work Items'));
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('only shows allocations matching the current quarter', () => {
    const otherQuarterAlloc = [
      ...allocations,
      { id: 'a3', team_member_id: 'member-1', quarter: 'Q2 2025', work_area_id: 'wa-leading', percent: 99 },
    ];
    render(
      <QuarterlyAllocationTable
        members={members}
        workAreas={workAreas}
        allocations={otherQuarterAlloc}
        quarter={quarter}
        onAllocationChange={() => {}}
        selectedTeamId={teamId}
        initialSelectedWorkAreaIds={selectedWorkAreaIds}
      />
    );
    // 99% should not appear — it's for Q2 2025, not Q1 2025
    expect(screen.queryByText('99%')).not.toBeInTheDocument();
  });
});
