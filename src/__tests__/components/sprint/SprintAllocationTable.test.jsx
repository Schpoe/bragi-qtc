import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import SprintAllocationTable from '@/components/sprint/SprintAllocationTable';

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

vi.mock('@/components/sprint/AllocationCell', () => ({
  default: ({ value, onChange }) => (
    <input
      aria-label="allocation"
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ),
}));

vi.mock('../shared/DisciplineBadge', () => ({
  default: ({ discipline }) => <span data-testid="discipline">{discipline}</span>,
}));

// resolve relative import used inside SprintAllocationTable
vi.mock('@/components/shared/DisciplineBadge', () => ({
  default: ({ discipline }) => <span data-testid="discipline">{discipline}</span>,
}));

const adminUser = { role: 'admin', managed_team_ids: [] };
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

const sprint = {
  id: 'sprint-1',
  team_id: teamId,
  relevant_work_area_ids: ['wa-leading', 'wa-supporting', 'wa-other'],
};

const members = [
  { id: 'member-1', name: 'Alice', discipline: 'Engineering', availability_percent: 100 },
  { id: 'member-2', name: 'Bob', discipline: 'Design', availability_percent: 80 },
];

const workAreas = [
  { id: 'wa-leading', name: 'Feature Work', color: '#3b82f6', leading_team_id: teamId, supporting_team_ids: [] },
  { id: 'wa-supporting', name: 'Platform', color: '#f59e0b', leading_team_id: 'team-2', supporting_team_ids: [teamId] },
  { id: 'wa-other', name: 'Ops', color: '#6b7280', leading_team_id: 'team-3', supporting_team_ids: [] },
];

const allocations = [
  { id: 'a1', team_member_id: 'member-1', sprint_id: 'sprint-1', work_area_id: 'wa-leading', percent: 50 },
  { id: 'a2', team_member_id: 'member-1', sprint_id: 'sprint-1', work_area_id: 'wa-supporting', percent: 30 },
  { id: 'a3', team_member_id: 'member-2', sprint_id: 'sprint-1', work_area_id: 'wa-leading', percent: 40 },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SprintAllocationTable', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: adminUser });
  });

  it('renders member names', () => {
    render(
      <SprintAllocationTable
        sprint={sprint}
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        onAllocationChange={() => {}}
      />
    );
    // component renders desktop + mobile views, so names appear multiple times
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0);
  });

  it('renders work area column headers', () => {
    render(
      <SprintAllocationTable
        sprint={sprint}
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        onAllocationChange={() => {}}
      />
    );
    expect(screen.getAllByText('Feature Work').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Platform').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ops').length).toBeGreaterThan(0);
  });

  it('renders group headers Leading / Supporting / Other when multiple groups exist', () => {
    render(
      <SprintAllocationTable
        sprint={sprint}
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        onAllocationChange={() => {}}
      />
    );
    expect(screen.getAllByText('Leading').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Supporting').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Other').length).toBeGreaterThan(0);
  });

  it('does not render group header row when only one group', () => {
    const leadingOnlySprint = { ...sprint, relevant_work_area_ids: ['wa-leading'] };
    render(
      <SprintAllocationTable
        sprint={leadingOnlySprint}
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        onAllocationChange={() => {}}
      />
    );
    expect(screen.queryByText('Leading')).not.toBeInTheDocument();
    expect(screen.queryByText('Supporting')).not.toBeInTheDocument();
  });

  it('shows editable AllocationCell inputs for admin', () => {
    render(
      <SprintAllocationTable
        sprint={sprint}
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        onAllocationChange={() => {}}
      />
    );
    const inputs = screen.getAllByLabelText('allocation');
    // desktop + mobile = 2 views × (2 members × 3 work areas) = 12 inputs
    expect(inputs).toHaveLength(12);
  });

  it('shows read-only values for viewer (no inputs)', () => {
    useAuth.mockReturnValue({ user: viewerUser });
    render(
      <SprintAllocationTable
        sprint={sprint}
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        onAllocationChange={() => {}}
      />
    );
    expect(screen.queryAllByLabelText('allocation')).toHaveLength(0);
    // Alice's allocation for Feature Work (appears in desktop + mobile)
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
  });

  it('shows empty state message when no members', () => {
    render(
      <SprintAllocationTable
        sprint={sprint}
        members={[]}
        workAreas={workAreas}
        allocations={[]}
        onAllocationChange={() => {}}
      />
    );
    expect(screen.getByText('No team members found.')).toBeInTheDocument();
  });

  it('shows empty state message when no work areas on sprint', () => {
    const sprintNoWAs = { ...sprint, relevant_work_area_ids: [] };
    render(
      <SprintAllocationTable
        sprint={sprintNoWAs}
        members={members}
        workAreas={workAreas}
        allocations={[]}
        onAllocationChange={() => {}}
      />
    );
    expect(screen.getByText('No work items defined.')).toBeInTheDocument();
  });

  it('calls onAllocationChange when an allocation input changes', () => {
    const onAllocationChange = vi.fn();
    render(
      <SprintAllocationTable
        sprint={sprint}
        members={members}
        workAreas={workAreas}
        allocations={allocations}
        onAllocationChange={onAllocationChange}
      />
    );
    const inputs = screen.getAllByLabelText('allocation');
    // Simulate value change on Alice × Feature Work cell
    fireEvent.change(inputs[0], { target: { value: '60' } });
    expect(onAllocationChange).toHaveBeenCalledWith('member-1', 'sprint-1', 'wa-leading', 60);
  });
});
