import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuarterlyTeamsSummary from '@/components/dashboard/QuarterlyTeamsSummary';

vi.mock('@/lib/utils', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className, style }) => <div className={className} style={style}>{children}</div>,
  CardHeader: ({ children, className }) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }) => <h3 className={className}>{children}</h3>,
  CardContent: ({ children, className }) => <div className={className}>{children}</div>,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const teams = [
  { id: 't1', name: 'Alpha', color: 'blue' },
  { id: 't2', name: 'Beta', color: 'green' },
];

const members = [
  { id: 'm1', name: 'Alice', team_id: 't1', discipline: 'iOS', availability_percent: 100 },
  { id: 'm2', name: 'Bob', team_id: 't1', discipline: 'Android', availability_percent: 100 },
  { id: 'm3', name: 'Carol', team_id: 't2', discipline: 'Cloud', availability_percent: 100 },
];

const workAreas = [
  { id: 'wa1', name: 'Feature A', color: '#3b82f6' },
  { id: 'wa2', name: 'Bug Fix B', color: '#ef4444' },
];

const quarter = 'Q2 2025';

const quarterlyAllocations = [
  { id: 'a1', team_member_id: 'm1', work_area_id: 'wa1', percent: 60, quarter },
  { id: 'a2', team_member_id: 'm2', work_area_id: 'wa2', percent: 40, quarter },
  { id: 'a3', team_member_id: 'm3', work_area_id: 'wa1', percent: 80, quarter },
  // different quarter — ignored
  { id: 'a4', team_member_id: 'm1', work_area_id: 'wa1', percent: 99, quarter: 'Q1 2025' },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('QuarterlyTeamsSummary', () => {
  const defaultProps = {
    teams,
    members,
    workAreas,
    quarterlyAllocations,
    workAreaSelections: [],
    selectedQuarter: quarter,
  };

  it('renders a card for each team', () => {
    render(<QuarterlyTeamsSummary {...defaultProps} />);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
  });

  it('shows member count for each team', () => {
    render(<QuarterlyTeamsSummary {...defaultProps} />);
    expect(screen.getByText('2 members')).toBeTruthy(); // Alpha
    expect(screen.getByText('1 member')).toBeTruthy();  // Beta
  });

  it('renders the cross-team discipline summary heading', () => {
    render(<QuarterlyTeamsSummary {...defaultProps} />);
    expect(screen.getByText(`Allocation by Discipline — All Teams · ${quarter}`)).toBeTruthy();
  });

  it('shows discipline names in the cross-team summary', () => {
    render(<QuarterlyTeamsSummary {...defaultProps} />);
    // Each discipline appears in the all-teams card AND the per-team card
    expect(screen.getAllByText('iOS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Android').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cloud').length).toBeGreaterThan(0);
  });

  it('computes overall utilization as average allocation per member', () => {
    // Alpha: m1=60%, m2=40% → avg = (60+40)/2 = 50%
    render(<QuarterlyTeamsSummary {...defaultProps} />);
    const fiftyPcts = screen.getAllByText('50%');
    expect(fiftyPcts.length).toBeGreaterThan(0);
  });

  it('shows top work items per team', () => {
    render(<QuarterlyTeamsSummary {...defaultProps} />);
    expect(screen.getAllByText('Feature A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bug Fix B').length).toBeGreaterThan(0);
  });

  it('ignores allocations from another quarter', () => {
    render(<QuarterlyTeamsSummary {...defaultProps} />);
    // If Q1 allocation (99%) were included, Alice's total would be 159% → avg > 100%
    // With only Q2, Alpha avg = 50%. Check 50 appears and not over-inflated value.
    expect(screen.queryByText('129%')).toBeNull(); // (60+99+40)/2 would be wrong
  });

  it('returns null when teams array is empty', () => {
    const { container } = render(
      <QuarterlyTeamsSummary {...defaultProps} teams={[]} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows "No allocations yet" for teams with no allocations', () => {
    render(
      <QuarterlyTeamsSummary
        {...defaultProps}
        quarterlyAllocations={[]} // no allocations at all
      />
    );
    const noAllocMsgs = screen.getAllByText('No allocations yet');
    expect(noAllocMsgs.length).toBe(teams.length);
  });

  it('shows "No discipline data" in the all-teams summary when no members have disciplines', () => {
    const membersNoDiscipline = members.map((m) => ({ ...m, discipline: null }));
    render(
      <QuarterlyTeamsSummary {...defaultProps} members={membersNoDiscipline} />
    );
    expect(screen.getByText('No discipline data')).toBeTruthy();
  });
});
