# Quarterly Capacity Planning

This guide explains how to use the quarterly capacity planning features in Bragi QTC — from setting up the plan at the start of a quarter, through tracking changes, to comparing outcomes with Jira actuals at the end.

---

## Overview

The quarterly plan answers three questions:

1. **What are we planning to work on this quarter?** — which work items each team has selected
2. **How much capacity is allocated per person per work item?** — the allocation table (in days)
3. **How did the plan evolve, and how did reality compare?** — tracked via the initial plan snapshot and Jira actuals

---

## Prerequisites

### 1. Teams and members

Each team must have at least one member. Go to **Teams**, create your teams and add members. Each member has a **sprint_days** value (their available days per sprint) which drives capacity defaults. Team colors are set as hex values via the color picker.

For Jira integration, set the **Jira Project Key** on the team (Teams → edit team → "Jira Project Key", e.g. `MOBILE`). This is used to pull actuals at the end of the quarter.

Each team also has a **Working days per story point** value (Teams → edit team). This is the per-team factor used to convert delivered story points into days for the plan-vs-delivered comparison — because 1 SP is rarely exactly 1 person-day, and the ratio differs per team. It defaults to `1`. (A future enhancement will derive this automatically from BambooHR absence data ÷ delivered SP; for now it is set manually.)

### 2. Work items

Work items (features, projects, epics) are managed under **Work Items**. Each work item can have:

| Field | Description |
|-------|-------------|
| **Leading team** | Primary owner of this work item |
| **Supporting teams** | Teams contributing to this work item |
| **PROD ID** (`prod_id`) | The Jira key of the PROD item (e.g. `PROD-123`). Used to match work items to Jira actuals. |
| **Jira key** | An Epic key or PROD key for Jira sync (legacy / fallback) |
| **Linked epic keys** | Additional Epic keys linked to this work item |

The `prod_id` is the primary matching key between the capacity plan and Jira actuals. Both the PROD ID and its title are shown as a badge on each work item card.

### 3. Jira configuration (optional)

Set `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` in your `.env` file to enable Jira sync and actuals fetching. `JIRA_BASE_URL` is also used to make every Jira key in the app (PROD IDs, Epic keys, sync candidates) a clickable link that opens the issue in a new tab.

The app automatically detects your Jira story points field by looking for common field names (`Story Points`, `Story point estimate`, etc.). You can override this with `JIRA_STORY_POINTS_FIELD` in `.env`.

**Excluded statuses.** Tickets in a cancelled status — by default `Obsolete / Won't Do` plus common variants (`Won't Fix`, `Cancelled`, `Rejected`, `Duplicate`, `Declined`, `Abandoned`) — are counted as **neither delivered nor in progress**. They are reported separately as "Cancelled". Override the list with `JIRA_EXCLUDED_STATUSES` in `.env` (comma-separated status names, case-insensitive), e.g. `JIRA_EXCLUDED_STATUSES=Obsolete / Won't Do,Rejected`.

---

## Setting Up a Quarterly Plan

### Step 1 — Select the quarter and team

Go to **Quarterly Planning**. Use the filter bar at the top to select the quarter (e.g. `Q2 2025`) and a specific team.

The quarter selector is sticky — your selection persists when navigating between pages.

### Step 2 — Select work items

Click **"Select Work Items"** in the allocation table. A dialog shows work items grouped into three tabs:

| Tab | Description |
|-----|-------------|
| **Leading** | Work items where this team is the leading team |
| **Supporting** | Work items where this team is a supporting team |
| **Other** | All other work items |

Check the items this team will work on this quarter. Already-selected items appear at the top. You can search by work item name or Jira key. Click **Apply Selection** to confirm.

### Step 3 — Set allocations

The allocation table shows team members as rows and selected work items as columns.

- Click or type in any cell to set the number of days a member will spend on that work item
- The **Capacity** column shows each member's total available days for the quarter (editable per-member per-quarter)
- The **Allocated** column shows total allocated days and the utilisation percentage:
  - Green: under 80%
  - Amber: 80–100%
  - Red: over-allocated
- Changes are saved automatically

### Step 4 — Lock the initial plan

Once the plan is agreed, save it as the **initial plan**:

1. Open **Quarterly Plan History** (below the allocation table)
2. Go to the **Versions** tab
3. Click **"Save Current Version"** — enter a label such as `Initial Plan Q2 2025`
4. Click the **flag icon** on the saved snapshot to mark it as the initial plan

The snapshot is marked with a gold ★ badge. From this point, the allocation table shows deltas against the initial plan:

- `↑+5d vs plan` — member is allocated more than initially planned
- `↓-3d vs plan` — member is allocated less than initially planned
- **NEW** badge on a work item column header — this work item was not in the initial plan

---

## Managing Changes During the Quarter

Allocations can be adjusted at any time. The initial plan snapshot is never modified — it is always the reference point.

### Viewing changes

Open **Quarterly Plan History**:

| Tab | What it shows |
|-----|---------------|
| **Versions** | Saved snapshots. Use the flag icon to set the initial plan, use "Revert" to restore any snapshot. |
| **Changes** | Side-by-side comparison of initial vs current allocation per member/work item, with delta badges. |
| **Audit Log** | Every individual change, timestamped, grouped by date. |
| **Actuals** | Jira actuals fetched for the quarter, with plan vs delivery comparison. |

### Saving mid-quarter snapshots

You can save additional snapshots at any point (e.g. after a planning review). These are versioned independently of the initial plan. Use the flag icon to re-designate a different snapshot as the reference if the team formally re-baselined the plan.

### Reverting

Click **"Revert"** on any snapshot to restore all allocations and work item selections to that point in time. The current state is not automatically saved before reverting — save a version first if needed.

---

## End-of-Quarter: Comparing to Jira Actuals

At the end of the quarter, pull actual delivery data from Jira to compare against the plan.

### Requirements

- The team must have a **Jira Project Key** configured (Teams page → edit team)
- Jira credentials must be set in `.env`

### Fetching actuals

1. Open **Quarterly Plan History** → **Actuals** tab
2. The panel shows the planned capacity from the initial plan
3. Click **"Fetch from \<PROJECT\>"**

The panel fetches issues from Jira for the quarter's date range (e.g. 1 Apr – 30 Jun for Q2):

| Section | Logic |
|---------|-------|
| **Completed** | Issues **resolved within the quarter** (`resolutiondate` in range) — strictly completed *in* the quarter, not merely updated in it. An issue finished in an earlier quarter no longer counts. |
| **In Progress** | Still-open issues (unresolved) updated during the quarter, excluding backlog/to-do |
| **Cancelled** | Issues resolved within the quarter in an excluded status (`Obsolete / Won't Do` etc.) — counted as neither delivered nor in progress |

### Plan vs Delivered — summary

At the top of the fetched actuals is a **days-based summary** (the unit mismatch between planned *days* and delivered *story points* is resolved using the team's Working-days-per-SP factor). It shows:

- **Headline cards:** planned (initial vs current), delivered (done), in progress, unplanned work, delivered-on-plan, and cancelled count — all in days except the cancelled ticket count.
- **Deviation narrative:** how much of the plan was delivered (%), how much effort went to unplanned topics (% of all activity), and how many tickets were excluded.
- **Per-bucket breakdowns:**
  - **Planned topics** — planned vs delivered vs in-progress days, with a **Leading**/**Supporting** tag showing the team's role on each.
  - **Unplanned PROD topics** — PROD work delivered/in-progress that was not in the plan (also tagged Leading/Supporting where the team owns the work item).
  - **Unplanned non-PROD topics** — Jira work with no PROD link.

The summary is **exportable** via the **CSV** and **PDF** buttons in its header. PROD/Epic keys throughout are clickable and open the issue in Jira in a new tab.

### Visual comparison — bar chart

Below the summary, a **bar chart** compares plan vs delivery per PROD item. Story points are translated to days using the team's **Working days per story point** factor (shown as `1 SP = N days` on the chart) so all bars use the same unit:

| Bar | Colour | Source |
|-----|--------|--------|
| Initial Plan | Amber | Days from the initial plan snapshot |
| Current Plan | Purple | Days from the current allocation |
| Done | Green | Completed story points (as days) |
| In Progress | Blue | In-progress story points (as days) |

Up to 15 items are shown in the chart. All items appear in the table below it.

### PROD-based breakdown table

Below the chart, a table groups all work by PROD item. Each row is labelled with its category:

| Badge | Meaning |
|-------|---------|
| **Planned** (green) | In the initial quarterly plan, has a PROD link |
| **Unplanned** (amber) | Appeared in Jira actuals but was not planned |
| **Epic** (blue) | Jira Epic with no parent PROD item |
| **No PROD link** (gray) | In the plan but work item has no `prod_id` set |

Both the PROD ID (e.g. `PROD-123`) and the PROD title are shown for each row.

### How PROD matching works

Work items are matched to Jira actuals using the `prod_id` field on each work item. For each issue fetched from Jira:

1. The issue's Epic is identified — via the `parent` field (team-managed projects) or the auto-detected **Epic Link** field (company-managed projects).
2. The Epic is fetched from Jira to find its PROD item. The resolver:
   - scans **all** of the Epic's issue links, in **both** directions, for a linked issue that belongs to a **PROD project**, preferring an **"implements"**-style relationship;
   - falls back to the Epic's **parent** if the parent is itself a PROD item.
3. Story points are summed from individual issues (not from the Epic itself).

**Which projects count as "PROD"** is taken from the project keys of the team's planned `prod_id` values (e.g. `PROD-123` → project `PROD`), so it adapts automatically. Override with `JIRA_PROD_PROJECT_KEY` in `.env` if needed. The Epic Link field is auto-detected but can be forced with `JIRA_EPIC_LINK_FIELD`.

If a work item has no `prod_id`, the match falls back to `jira_key` and `linked_epic_keys`.

**Diagnosing gaps.** Epics that don't resolve to a PROD show up under **Unplanned non-PROD**. The Actuals tab lists them in an expandable "N epics with no PROD link" panel, including each epic's existing links, so you can see exactly what to fix in Jira (add an "implements" link to the PROD, or set the PROD as the Epic's parent) and re-fetch.

---

## All Teams View

When **"All Teams"** is selected in the filter bar, the Quarterly Planning page shows one planning card per active team for the selected quarter. Each card is independent — work item selection and allocations are managed per team.

Disabled teams (Teams page → disable toggle) are excluded from all views.

---

## Quarterly Plan History — Quick Reference

| Action | Where |
|--------|-------|
| Save a version | History → Versions → "Save Current Version" |
| Set initial plan | History → Versions → flag icon on a snapshot |
| Revert to a version | History → Versions → "Revert" |
| View allocation changes | History → Changes tab |
| View full audit trail | History → Audit Log tab |
| Fetch Jira actuals | History → Actuals tab |
| View plan vs actuals chart | History → Actuals tab (after fetching) |
