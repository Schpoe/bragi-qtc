vi.mock('../prisma', () => ({}));
vi.mock('../lib/jira', () => ({}));
vi.mock('../lib/bamboohr', () => ({
  isConfigured: () => true,
  CONSULTANT_POLICY_RE: /consultant|external/i,
  fetchVacationBalances: vi.fn(),
  fetchDirectory: vi.fn(),
  fetchApprovedTimeOffDays: vi.fn(),
  countWeekdays: vi.fn(),
}));
vi.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
}));

const { _internal } = require('./functions');
const { vacationDeadlineInfo } = _internal;

describe('vacationDeadlineInfo', () => {
  it('caps the at-risk amount at 10 and anchors the deadline to Dec 31 outside the grace period', () => {
    const today = new Date(Date.UTC(2026, 5, 15)); // June 15
    const result = vacationDeadlineInfo(14, today);
    expect(result.atRiskAmount).toBe(4); // 14 - 10
    expect(result.deadline.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('reports nothing at risk outside the grace period when balance is under the cap', () => {
    const today = new Date(Date.UTC(2026, 5, 15));
    const result = vacationDeadlineInfo(7, today);
    expect(result.atRiskAmount).toBe(0);
    expect(result.deadline.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('caps the at-risk amount to the balance itself during the Jan–Mar grace period', () => {
    const today = new Date(Date.UTC(2026, 1, 10)); // Feb 10
    const result = vacationDeadlineInfo(4, today);
    expect(result.atRiskAmount).toBe(4);
    expect(result.deadline.toISOString().slice(0, 10)).toBe('2026-03-31');
  });

  it('caps the at-risk amount at 10 during the grace period even if the carried balance is larger', () => {
    const today = new Date(Date.UTC(2026, 1, 10));
    const result = vacationDeadlineInfo(16, today);
    expect(result.atRiskAmount).toBe(10);
    expect(result.deadline.toISOString().slice(0, 10)).toBe('2026-03-31');
  });

  it('treats March 31 as still within the grace period', () => {
    const today = new Date(Date.UTC(2026, 2, 31)); // March 31
    const result = vacationDeadlineInfo(12, today);
    expect(result.deadline.toISOString().slice(0, 10)).toBe('2026-03-31');
  });

  it('treats April 1 as outside the grace period', () => {
    const today = new Date(Date.UTC(2026, 3, 1)); // April 1
    const result = vacationDeadlineInfo(12, today);
    expect(result.deadline.toISOString().slice(0, 10)).toBe('2026-12-31');
    expect(result.atRiskAmount).toBe(2); // 12 - 10
  });

  it('treats Jan 1 as within the following year\'s grace period, anchored to that year\'s March 31', () => {
    const today = new Date(Date.UTC(2027, 0, 1)); // Jan 1, 2027
    const result = vacationDeadlineInfo(9, today);
    expect(result.deadline.toISOString().slice(0, 10)).toBe('2027-03-31');
  });
});
