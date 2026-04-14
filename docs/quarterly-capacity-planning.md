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

Each team must have at least one member. Go to **Teams**, create your teams and add members. Each member has a **sprint_days** value (their available days per sprint) which drives capacity defaults.

For Jira integration, set the **Jira Project Key** on the team (Teams → edit team → "Jira Project Key", e.g. `MOBILE`). This is used to pull actuals at the end of the quarter.

### 2. Work items

Work items (epics, features, projects) are managed under **Work Items**. Each work item can have:
- A **leading team** (primary owner)
- **Supporting teams** (contributing teams)
- A **Jira key** or **linked epic keys** for Jira sync

### 3. Jira configuration (optional)

Set `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` in your `.env` file to enable Jira sync and actuals fetching.

---

## Setting Up a Quarterly Plan

### Step 1 — Select the quarter and team

Go to **Capacity Planning**. Use the filter bar at the top to select the quarter (e.g. `Q2 2025`) and a specific team.

The quarter selector is sticky — your selection persists when navigating between pages.

### Step 2 — Select work items

Click **"Select Work Items"** in the allocation table. A dialog shows work items grouped into three tabs:

| Tab | Description |
|-----|-------------|
| **Leading** | Work items where this team is the leading team |
| **Supporting** | Work items where this team is a supporting team |
| **Other** | All other work items |

Check the items this team will work on this quarter. Already-selected items appear at the top. Click **Apply Selection** to confirm.

### Step 3 — Set allocations

The allocation table shows team members as rows and selected work items as columns.

- Click or type in any cell to set the number of days a member will spend on that work item
- The **Capacity** column shows each member's total available days for the quarter (editable per-member per-quarter)
- The **Allocated** column shows total allocated days and the utilisation percentage
  - Green: under 80%
  - Amber: 80–100%
  - Red: over-allocated
- Changes are saved automatically

### Step 4 — Lock the initial plan

Once the plan is agreed, save it as the **initial plan**:

1. Open **Quarterly Plan History** (below the allocation table)
2. Go to the **Versions** tab
3. Click **"Save Current Version"** — enter a label such as `Initial Plan Q2 2025`
4. Click **"Set Initial"** on the saved snapshot

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
| **Versions** | Saved snapshots. Use "Revert" to restore any snapshot. |
| **Changes** | Side-by-side comparison of initial vs current allocation per member/work item, with delta badges. |
| **Audit Log** | Every individual change, timestamped, grouped by date. |

### Saving mid-quarter snapshots

You can save additional snapshots at any point (e.g. after a planning review). These are versioned independently of the initial plan. Use "Set Initial" to re-designate a different snapshot as the reference if the team formally re-baselined the plan.

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
2. The panel shows the planned capacity from the initial plan (and current plan if it differs)
3. Click **"Fetch from \<PROJECT\>"**

The panel fetches two sets of issues from Jira for the quarter's date range (e.g. 1 Apr – 30 Jun for Q2):

| Section | JQL logic |
|---------|-----------|
| **Completed** | Issues where status changed to `Done` during the quarter |
| **In Progress** | Issues that were worked on (moved out of backlog) but not completed |

For each section, the panel shows:
- **Issue count**
- **Story points** (auto-detected from your Jira field configuration)

### Reading the comparison

Planned days and Jira story points are different units — the panel shows them side by side so you can interpret the ratio for your team:

```
180d planned (initial)  →  47 SP completed  +  18 SP in progress
```

Expand the issue lists to see individual issues with their key, summary, current status, and story points.

### Story points field detection

The app automatically detects your Jira story points field by looking for common field names (`Story Points`, `Story point estimate`, etc.). If your Jira uses a non-standard name, check the field name in your Jira field settings — the detected field ID is shown in the actuals panel.

---

## All Teams View

When **"All Teams"** is selected in the filter bar, the Capacity Planning page shows one planning card per active team for the selected quarter. Each card is independent — work item selection and allocations are managed per team.

Disabled teams (Teams page → disable toggle) are excluded from all views.

---

## Exporting

From the **Overview** page, use the export buttons to download the quarterly plan in:

| Format | Contents |
|--------|----------|
| **Excel (.xlsx)** | Team summary, discipline breakdown, member allocations, top work items |
| **CSV** | Flat format with team, member, discipline, work area, and allocation |
| **JSON** | Structured data for programmatic use |
| **PDF** | Screenshot of the current quarterly overview |

---

## Quarterly Plan History — Reference

| Action | Where |
|--------|-------|
| Save a version | History → Versions → "Save Current Version" |
| Set initial plan | History → Versions → "Set Initial" on a snapshot |
| Revert to a version | History → Versions → "Revert" |
| View allocation changes | History → Changes tab |
| View full audit trail | History → Audit Log tab |
| Fetch Jira actuals | History → Actuals tab |
| Export plan | Overview page → export buttons |
