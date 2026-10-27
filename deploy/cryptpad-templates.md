# CryptPad templates (R2.2)

Build these on the self-hosted pad instance (see `cryptpad-plan.md`).
Each template is a one-time setup; committees clone them per drive.
Files here are ready-to-paste starters — CryptPad has no template import,
so the guide walks through building each pad once and using CryptPad's
own "Save as template".

## 1. Wall chart (Spreadsheet)

Columns (row 1, left to right):

```
Name | Dept | Shift | Language | Rating | Point person | Last contact | Next step | Issues
```

- **Rating column:** data validation dropdown with the words, never bare numbers:
  `1 Strong yes` · `2 Leaning yes` · `3 Unsure` · `4 Leaning no` · `5 Against`.
- **Summary tab** formulas (per dept, assume 30 data rows):

```
Supporters:  =COUNTIFS(Dept range,"=<dept>",Rating range,"1 Strong yes")+COUNTIFS(...,"2 Leaning yes")
Percent 1–2: =IFERROR(supporters/COUNTIFS(Dept range,"=<dept>"),0)
30% check:   =IF(pct>=0.3,"✓ filing floor","under 30%")
70% check:   =IF(pct>=0.7,"✓ go","under 70%")
```

- Site rule (AGENTS.md): the 1–5 rating always shows words next to the number,
  in the worker's language; color alone never carries the rating.

## 2. One-on-one tracker (Kanban)

Columns: `To contact` → `Talked` → `Follow-up due` → `Committed`.
Card fields: name, dept/shift, issues (tags), last contact date, next step.
Tags mirror the wall chart's Issues column so the two views stay consistent.

## 3. Issue board (Kanban)

Columns: `Raised` → `Being worked` → `Boss answered` → `Won` → `Lost/learned`.
One card per workplace issue; link the related wall-chart rows in the description.

## 4. Action planner (Kanban)

Columns: `Idea` → `Planned (date)` → `Ready` → `Done`.
Every card names an owner and a date; the ladder order follows the escalation
ladder on `/contract/campaign` (buttons → petition → picket support → …).

## 5. Meeting notes and decisions (Document)

Header block: date, attendees, decisions, next meeting.
Decisions as a numbered list at the top — committees die when decisions are
buried in prose. Notes below.

## 6. Bargaining survey form (Form)

Question bank: use `/contract/survey` (site page) — trade-off questions,
department/shift logistics, nothing identifying. Results export to the
wall chart's summary tab logic (support %, participation by dept).

## 7. Setup and member-removal guide (Document)

Paste into every new drive's root folder. The non-negotiable caveat:

> **Removing someone does not remove their access to documents you already
> shared with them.** CryptPad access is via link + account. To actually
> remove someone: create NEW documents, re-share only with the remaining
> members, and treat the old ones as burned. Do this before the person
> knows they're being removed, never after.

Also in the guide: passphrase hygiene (each member, unique), no real names in
pad titles (pad titles are metadata), and the "one drive per campaign, not per
person" rule so handoff (R3 export) stays possible.
