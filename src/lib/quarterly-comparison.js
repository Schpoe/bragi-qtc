// Shared aggregation for the plan-vs-delivered comparison, used by the live
// summary, the "Finalize quarter" capture, and the Quarterly Review page so they
// always agree. Operates on the precomputed `rows` produced by the Actuals tab.

const round1 = (n) => Math.round((n || 0) * 10) / 10;

/**
 * Converts a row's SP for a given state ("completed"/"inProgress") to days. Uses the
 * row's per-role split (e.g. completedDevSP/completedQaSP) when present, applying
 * daysPerSp/qaDaysPerSp separately; otherwise falls back to applying daysPerSp to the
 * plain <state>SP total (legacy behavior, e.g. for snapshots captured before the QA
 * rate existed). Shared by summarizeComparison and any UI that needs the same
 * per-row days figure it produces internally.
 */
export function rowDaysFor(r, state, daysPerSp = 1, qaDaysPerSp = daysPerSp) {
  const devSP = r[`${state}DevSP`];
  const qaSP = r[`${state}QaSP`];
  if (devSP != null || qaSP != null) {
    return round1((devSP || 0) * daysPerSp + (qaSP || 0) * qaDaysPerSp);
  }
  return round1((r[`${state}SP`] || 0) * daysPerSp);
}

/**
 * @param {Array} rows - comparison rows (category, initialDays, currentDays, completedSP, inProgressSP, ...).
 *   Rows may optionally carry completedDevSP/completedQaSP and inProgressDevSP/inProgressQaSP — a per-role
 *   split of the SP total, used to apply daysPerSp/qaDaysPerSp separately. Rows without the split (e.g. older
 *   finalized snapshots) fall back to applying daysPerSp to the plain completedSP/inProgressSP total.
 * @param {number} daysPerSp - team factor converting Developer story points to days
 * @param {{count?: number, storyPoints?: number}} [excluded] - cancelled totals
 * @param {number} [qaDaysPerSp] - team factor converting QA story points to days (defaults to daysPerSp)
 */
export function summarizeComparison(rows = [], daysPerSp = 1, excluded = null, qaDaysPerSp = daysPerSp) {
  const rowDays = (r, state) => rowDaysFor(r, state, daysPerSp, qaDaysPerSp);
  const sum = (arr, f) => round1(arr.reduce((s, r) => s + (f(r) || 0), 0));

  const planned          = rows.filter(r => r.category === "planned" || r.category === "planned-no-prod");
  const unplannedProd    = rows.filter(r => r.category === "unplanned");
  const unplannedNonProd = rows.filter(r => r.category === "epic-only" || r.category === "unassigned");

  const plannedInitial = sum(planned, r => r.initialDays);
  const plannedCurrent = sum(planned, r => r.currentDays);

  const deliveredPlanned  = sum(planned, r => rowDays(r, "completed"));
  const inProgPlanned     = sum(planned, r => rowDays(r, "inProgress"));
  const deliveredUnplProd = sum(unplannedProd, r => rowDays(r, "completed"));
  const inProgUnplProd    = sum(unplannedProd, r => rowDays(r, "inProgress"));
  const deliveredUnplNon  = sum(unplannedNonProd, r => rowDays(r, "completed"));
  const inProgUnplNon     = sum(unplannedNonProd, r => rowDays(r, "inProgress"));

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
  const dlv = (r) => rowDays(r, "completed");
  const ip  = (r) => rowDays(r, "inProgress");
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
