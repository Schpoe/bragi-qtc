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

  // Mutually-exclusive breakdown (days) by topic type × delivery state.
  // PROD-planned (1-3) + planned capacity (4) reconcile against the plan;
  // unplanned PROD (5-6) and non-PROD (7-8) are the extra work on top.
  // Capacity buckets (planned, no PROD link — e.g. "Time Off") are NOT counted as a
  // delivery gap; they're planned days with no Jira delivery by nature.
  const dlv = (r) => spToDays(r.completedSP);
  const ip  = (r) => spToDays(r.inProgressSP);
  const prodPlanned     = rows.filter(r => r.category === "planned");
  const capacityPlanned = rows.filter(r => r.category === "planned-no-prod");
  const buckets = {
    prodPlannedDelivered:    sum(prodPlanned, dlv),
    prodPlannedInProgress:   sum(prodPlanned, ip),
    prodPlannedNotDelivered: sum(prodPlanned, r => Math.max(0, (r.initialDays || 0) - dlv(r) - ip(r))),
    plannedCapacity:         sum(capacityPlanned, r => r.initialDays),
    unplannedProdDelivered:  deliveredUnplProd,
    unplannedProdInProgress: inProgUnplProd,
    nonProdDelivered:        deliveredUnplNon,
    nonProdInProgress:       inProgUnplNon,
  };
  const plannedNotDelivered = buckets.prodPlannedNotDelivered;

  return {
    planned, unplannedProd, unplannedNonProd,
    plannedInitial, plannedCurrent,
    deliveredPlanned, inProgPlanned,
    deliveredUnplProd, inProgUnplProd,
    deliveredUnplNon, inProgUnplNon,
    totalDelivered, totalInProgress, totalUnplanned, totalActivity,
    excludedCount, excludedSP,
    deliveryPct, unplannedPct,
    buckets, plannedNotDelivered,
  };
}

// Bucket display config — shared by the Review charts (and anywhere the
// topic-type × state breakdown is shown), so colours/labels stay consistent.
export const COMPARISON_BUCKETS = [
  { key: "prodPlannedDelivered",    label: "Planned PROD · delivered",     color: "#10b981" },
  { key: "prodPlannedInProgress",   label: "Planned PROD · in progress",   color: "#3b82f6" },
  { key: "prodPlannedNotDelivered", label: "Planned PROD · not delivered", color: "#94a3b8" },
  { key: "plannedCapacity",         label: "Planned capacity (non-PROD)",  color: "#f59e0b" },
  { key: "unplannedProdDelivered",  label: "Unplanned PROD · delivered",   color: "#8b5cf6" },
  { key: "unplannedProdInProgress", label: "Unplanned PROD · in progress", color: "#c4b5fd" },
  { key: "nonProdDelivered",        label: "Non-PROD · delivered",         color: "#14b8a6" },
  { key: "nonProdInProgress",       label: "Non-PROD · in progress",       color: "#5eead4" },
];
