import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import QuarterlyWorkItemSummary from '@/components/dashboard/QuarterlyWorkItemSummary';

vi.mock('@/lib/utils', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }) => <div className={className}>{children}</div>,
  CardHeader: ({ children, className }) => <div className={className}>{children}</div>,
  CardTitle: ({ children, className }) => <h3 className={className}>{children}</h3>,
  CardContent: ({ children, className }) => <div className={className}>{children}</div>,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const members = [
  { id: 'm1', name: 'Alice' },
  { id: 'm2', name: 'Bob' },
];

const workAreas = [
  { id: 'wa1', name: 'Feature A', type: 'Feature', color: '#3b82f6' },
  { id: 'wa2', name: 'Bug Fix B', type: 'Bug', color: '#ef4444' },
  { id: 'wa3', name: 'Epic C', type: 'Epic', color: '#8b5cf6' },
];

const quarter = 'Q2 2025';

const allocations = [
  { id: 'a1', team_member_id: 'm1', work_area_id: 'wa1', percent: 50, quarter },
  { id: 'a2', team_member_id: 'm2', work_area_id: 'wa1', percent: 30, quarter },
  { id: 'a3', team_member_id: 'm1', work_area_id: 'wa2', percent: 20, quarter },
  { id: 'a4', team_member_id: 'm2', work_area_id: 'wa3', percent: 40, quarter },
  // different quarter — must be ignored
  { id: 'a5', team_member_id: 'm1', work_area_id: 'wa1', percent: 99, quarter: 'Q1 2025' },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('QuarterlyWorkItemSummary', () => {
  it('renders Top 15 Work Items and Allocation by Work Item Type headings', () => {
    render(
      <QuarterlyWorkItemSummary
        members={members}
        workAreas={workAreas}
        quarterlyAllocations={allocations}
        selectedQuarter={quarter}
      />
    );
    expect(screen.getByText('Top 15 Work Items')).toBeTruthy();
    expect(screen.getByText('Allocation by Work Item Type')).toBeTruthy();
  });

  it('shows all work items that have allocations', () => {
    render(
      <QuarterlyWorkItemSummary
        members={members}
        workAreas={workAreas}
        quarterlyAllocations={allocations}
        selectedQuarter={quarter}
      />
    );
    expect(screen.getByText('Feature A')).toBeTruthy();
    expect(screen.getByText('Bug Fix B')).toBeTruthy();
    expect(screen.getByText('Epic C')).toBeTruthy();
  });

  it('sums allocations across members for each work item', () => {
    render(
      <QuarterlyWorkItemSummary
        members={members}
        workAreas={workAreas}
        quarterlyAllocations={allocations}
        selectedQuarter={quarter}
      />
    );
    // Feature A: 50 + 30 = 80% — appears in both work-item list and type breakdown
    expect(screen.getAllByText('80%').length).toBeGreaterThan(0);
    // Bug Fix B: 20%
    expect(screen.getAllByText('20%').length).toBeGreaterThan(0);
    // Epic C: 40%
    expect(screen.getAllByText('40%').length).toBeGreaterThan(0);
  });

  it('ignores allocations for a different quarter', () => {
    render(
      <QuarterlyWorkItemSummary
        members={members}
        workAreas={workAreas}
        quarterlyAllocations={allocations}
        selectedQuarter={quarter}
      />
    );
    // Q1 2025 allocation of 99% for wa1 must not appear
    expect(screen.queryByText('179%')).toBeNull(); // 80 + 99 would be 179
  });

  it('ignores allocations from members not in the members prop', () => {
    render(
      <QuarterlyWorkItemSummary
        members={[{ id: 'm1', name: 'Alice' }]} // only Alice
        workAreas={workAreas}
        quarterlyAllocations={allocations}
        selectedQuarter={quarter}
      />
    );
    // Feature A: only Alice's 50% (Bob's 30 excluded) — appears in list and type breakdown
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
    // Epic C: only Bob's 40% → should not appear at all (m2 excluded)
    expect(screen.queryByText('Epic C')).toBeNull();
  });

  it('shows all work item types', () => {
    render(
      <QuarterlyWorkItemSummary
        members={members}
        workAreas={workAreas}
        quarterlyAllocations={allocations}
        selectedQuarter={quarter}
      />
    );
    expect(screen.getByText('Feature')).toBeTruthy();
    expect(screen.getByText('Bug')).toBeTruthy();
    expect(screen.getByText('Epic')).toBeTruthy();
  });

  it('returns null when there are no allocations for the selected quarter', () => {
    const { container } = render(
      <QuarterlyWorkItemSummary
        members={members}
        workAreas={workAreas}
        quarterlyAllocations={[]}
        selectedQuarter={quarter}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('limits work items to top 15', () => {
    const manyWorkAreas = Array.from({ length: 20 }, (_, i) => ({
      id: `wa${i}`,
      name: `Work Area ${i}`,
      type: 'Feature',
      color: '#000',
    }));
    const manyAllocations = manyWorkAreas.map((wa, i) => ({
      id: `a${i}`,
      team_member_id: 'm1',
      work_area_id: wa.id,
      percent: 20 - i, // descending so first 15 are the highest
      quarter,
    }));

    render(
      <QuarterlyWorkItemSummary
        members={members}
        workAreas={manyWorkAreas}
        quarterlyAllocations={manyAllocations}
        selectedQuarter={quarter}
      />
    );

    // Work Area 0 (highest) should appear, Work Area 15+ should not
    expect(screen.getByText('Work Area 0')).toBeTruthy();
    expect(screen.queryByText('Work Area 15')).toBeNull();
    expect(screen.queryByText('Work Area 19')).toBeNull();
  });
});
