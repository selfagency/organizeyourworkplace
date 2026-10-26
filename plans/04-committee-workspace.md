# 04 Committee Workspace

An end-to-end encrypted space where a committee runs its campaign before any union is involved.

**Model:** Action Builder (Action Network with the AFL-CIO), whose core features are a wall chart, leader assessments, tasks and an activity log [A3]. Action Builder is sold to organizations through partnerships. Nothing comparable exists for a few workers organizing on their own. That's the gap this fills.

**Two stages:**
- **R2:** CryptPad templates, with no custom crypto.
- **R3:** a custom local-first app. Security requirements are in `05-security.md`, and they override anything here.

## Method the tools enforce

"You can't solve organizing with tech" [A2]. Tools track conversations and commitments, and **never broadcast anything.**
- **Unit of work:** a one-on-one, logged as who talked to whom, the issue, a rating from 1 (Strong yes) to 5 (Against), and the next step.
- **Measure of progress:** the share of each department and shift rated 1 or 2.
- **Flag danger:**
  - a shift with no natural leader;
  - a department nobody has talked to;
  - a coworker rated 4 or 5 who has been told too much.

## Design rules

1. **A 30-second log entry:** four taps (who, the new rating, issue tags, next step).
2. **One-handed use** during a 10-minute break. Works offline and syncs later.
3. **Plain labels:** "Strong yes / Leaning yes / Unsure / Leaning no / Against." Never use color alone; pair it with a label or shape.
4. **Coaching in every empty state.** For example: "Start by listing everyone on your shift. Here's why."
5. **Bilingual, with a preferred-language field on every coworker** for matching who talks to whom (Solidarity Tech's pattern [A13]).
6. **No public surfaces:** no social sharing, no link previews, and no lock-screen notifications that show names.

## Screens (R3)

| # | Screen | Contents | Borrowed from |
|---|---|---|---|
| 0 | Lock | Passphrase/PIN, optional disguise, panic wipe for this device | Tella |
| 1 | Today | Follow-ups due; the "no one is talking to these coworkers" count (headline number); majority meter (now / 30% / 70%); 4-week trend | Broadstripes turf panel, Action Builder Trend |
| 2 | Wall chart | Views: **Grid** (rows = departments/shifts, a dot per person), **Explorer** (department circles of dots), **Trend**. Quick filters: "Strong + leaning yes," "Unassigned," "Not contacted in 14 days" | Action Builder views + one-tap 1s and 2s [A10][A11]; Broadstripes Workplace Explorer [A12] |
| 3 | Coworker card | Name or nickname, dept/shift, language, rating and its history, top issues, social groups, point person, conversation timeline, next step + due date | Broadstripes timeline, Action Builder profile |
| 4 | Log a conversation | Bottom sheet: who, date, old → new rating, issue tags, note, next step. Saving creates the follow-up. | Broadstripes one-on-one dialog |
| 5 | Leaders & coverage | Tree: committee → leaders → the coworkers each covers. Flags any leader covering more than 10 people. | Broadstripes leadership tree |
| 6 | Social groups | Colored cards ("Night-shift smokers," "Spanish speakers"), each with its leader. Organizing spreads through lunch tables, not departments. | Broadstripes |
| 7 | Issues | Ranked by how many coworkers raised them, with each department's share. Feeds the message and the bargaining survey. | Action Builder custom questions |
| 8 | Actions | Templates (petition, march on the boss, button day), roles, turnout goal, debrief | Labor Notes escalation ladder |
| 9 | Evidence | Shared encrypted locker: incidents, photos, schedules, pay stubs; NLRB-ready timeline export | Tella |
| 10 | Members & keys | Roles; one-time invites with a 4-word check code; two-person removal with re-key; 2-of-3 recovery; count of devices holding a full copy | Signal admin approval, CryptPad caveat |
| 11 | Hand off | CSV export that Action Builder/Broadstripes can import, plus a summary for EWOC or the union's first call. **Needs a second core member's approval.** | Action Builder imports |

**Skip:** Action Builder's full query builder. Five coworkers on break don't need it.

**Avoid:** Solidarity Tech's automatic tracking of every call, text, visit and click. That is exactly the central record a secret campaign can't have.

## Data model (Yjs document per room)

```ts
type Rating = 1 | 2 | 3 | 4 | 5            // 1 Strong yes … 5 Against
interface Coworker { id: string; displayName: string; dept: string; shift: string;
  language: string; ratingHistory: {rating: Rating; at: ISODate; by: MemberId}[];
  issues: IssueId[]; groups: GroupId[]; pointPerson: MemberId | null;
  naturalLeader: boolean; nextStep?: {text: string; due: ISODate} }
interface Conversation { id; coworker: string; by: MemberId; at: ISODate;
  from?: Rating; to: Rating; issues: IssueId[]; note?: string; nextStep?: string }
interface Issue { id; label: string }      // counts are derived, not stored
interface Group { id; label: string; color: string; leader?: string }
interface Action { id; template: 'petition'|'march'|'button_day'|'other'; roles; goal: number; date; debrief? }
interface EvidenceItem { id; at; kind; description; blobRef?; prevHash: string; sig: string }
interface Unit { expectedSize: number }    // for the majority meter
```

- Derived values (percentages, coverage counts, the meter) are computed, never stored.
- Free-text notes show the guidance: "Assume anything written here may reach the boss. Keep the sharpest judgments out of notes."

## Rooms and permissions

Each room has its own key.

| Room | Members | Contents |
|---|---|---|
| **Core** | 3–7 core members | Full wall chart, all ratings, notes, evidence, members and keys |
| **Point person** | One organizer + Core | Only that organizer's assigned coworker cards. Their ratings flow back to Core. |
| **Committee** | Everyone who joined | Issue board, action plans, meeting notes. **No ratings, no full contact list.** |

| Action | Who can do it |
|---|---|
| Invite to Core / create Point person rooms | Core only ("Restricted" mode, as in SSB Rooms 2.0 [A23]) |
| Invite to Committee | Any member, but a core member approves the join ("Community" mode) |
| Remove a member | 2 core members |
| Export / hand off | 1 core member + approval from a second |
| See ratings and notes | Core; point persons for their own cards only |

## R2 templates (CryptPad, before the app exists)

Build these on a self-hosted CryptPad [A6][A18]:
- **Wall chart spreadsheet:** columns for name, dept, shift, language, rating (dropdown with labels), point person, last contact, next step, issues. A summary tab shows the % rated 1–2 per dept and the meter against 30%/70%.
- **One-on-one tracker:** a kanban with columns To contact · Talked · Follow-up due · Committed, with tags for issues.
- **Issue board, action planner, meeting notes and decisions.**
- **Bargaining survey form** (R4 content, available early).
- **Setup guide** with CryptPad's caveat made explicit: former team members can keep access. Removing someone means making new documents and new links, and sharing them only with the remaining members.

## Sync, invites, removal, storage (R3)

Specified in `05-security.md`:
- §Servers (matchmaker, relay, mailbox)
- §Invites
- §Removal
- §Device storage and iOS
- §Building blocks

## Research gaps (blockers for R3.9 and R3.8)

- [ ] Get the exact CSV import formats for Action Builder and Broadstripes. Both offer demos; a friendly union organizer can help.
- [ ] Watch real apps, not just marketing pages: AB 101 video, Action Builder Help Center, Broadstripes "How it works" + PASNAP case study.
- [ ] Run 5 usability sessions with non-organizers on paper prototypes of screens 1–4 before building. The agent prepares the prototypes and scripts; humans run the sessions.
