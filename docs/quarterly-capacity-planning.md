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

Set `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` in your `.env` file to enable Jira sync and actuals fetching.

The app automatically detects your Jira story points field by looking for common field names (`Story Points`, `Story point estimate`, etc.). You can override this with `JIRA_STORY_POINTS_FIELD` in `.env`.

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

The panel fetches two sets of issues from Jira for the quarter's date range (e.g. 1 Apr – 30 Jun for Q2):

| Section | Logic |
|---------|-------|
| **Completed** | Issues with a completed status (Done, Closed, Resolved) |
| **In Progress** | Issues started but not completed (excludes backlog/to-do) |

### Visual comparison — bar chart

The actuals panel shows a **bar chart** comparing plan vs delivery per PROD item. Story points are translated to days at **1 SP = 1 day** so all bars use the same unit:

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

1. The issue's Epic is identified
2. The Epic is fetched from Jira to find its parent PROD item — first via an **"implements"** issue link (outward from Epic to PROD), then falling back to the Epic's parent field
3. Story points are summed from individual issues (not from the Epic itself)

If a work item has no `prod_id`, the match falls back to `jira_key` and `linked_epic_keys`.

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
