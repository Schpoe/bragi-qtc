// Shared aggregation for the plan-vs-delivered comparison, used by the live
// summary, the "Finalize quarter" capture, and the Quarterly Review page so they
// always agree. Operates on the precomputed `rows` produced by the Actuals tab.

const round1 = (n) => Math.round((n || 0) * 10) / 10;

/**
 * @param {Array} rows - comparison rows (category, initialDays, currentDays, completedSP, inProgressSP, ...)
 * @param {number} daysPerSp - team factor converting story points to days
 * @param {{count?: number, storyPoints?: number}} [excluded] - cancelled totals
 */
export function summarizeComparison(rows = [], daysPerSp = 1, excluded = null) {
  const spToDays = (sp) => round1((sp || 0) * daysPerSp);
  const sum = (arr, f) => round1(arr.reduce((s, r) => s + (f(r) || 0), 0));

  const planned          = rows.filter(r => r.category === "planned" || r.category === "planned-no-prod");
  const unplannedProd    = rows.filter(r => r.category === "unplanned");
  const unplannedNonProd = rows.filter(r => r.category === "epic-only" || r.category === "unassigned");

  const plannedInitial = sum(planned, r => r.initialDays);
  const plannedCurrent = sum(planned, r => r.currentDays);

  const deliveredPlanned  = sum(planned, r => spToDays(r.completedSP));
  const inProgPlanned     = sum(planned, r => spToDays(r.inProgressSP));
  const deliveredUnplProd = sum(unplannedProd, r => spToDays(r.completedSP));
  const inProgUnplProd    = sum(unplannedProd, r => spToDays(r.inProgressSP));
  const deliveredUnplNon  = sum(unplannedNonProd, r => spToDays(r.completedSP));
  const inProgUnplNon     = sum(unplannedNonProd, r => spToDays(r.inProgressSP));

  const totalDelivered  = round1(deliveredPlanned + deliveredUnplProd + deliveredUnplNon);
  const totalInProgress = round1(inProgPlanned + inProgUnplProd + inProgUnplNon);
  const totalUnplanned  = round1(deliveredUnplProd + deliveredUnplNon + inProgUnplProd + inProgUnplNon);
  const totalActivity   = round1(totalDelivered + totalInProgress);

  const excludedCount = excluded?.count ?? 0;
  const excludedSP    = excluded?.storyPoints ?? 0;

  const deliveryPct  = plannedInitial > 0 ? Math.round(((deliveredPlanned + inProgPlanned) / plannedInitial) * 100) : null;
  const unplannedPct = totalActivity > 0 ? Math.round((totalUnplanned / totalActivity) * 100) : 0;

  return {
    planned, unplannedProd, unplannedNonProd,
    plannedInitial, plannedCurrent,
    deliveredPlanned, inProgPlanned,
    deliveredUnplProd, inProgUnplProd,
    deliveredUnplNon, inProgUnplNon,
    totalDelivered, totalInProgress, totalUnplanned, totalActivity,
    excludedCount, excludedSP,
    deliveryPct, unplannedPct,
  };
}
