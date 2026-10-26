# AGENTS.md: organizeyourworkplace.com

Read this file first. It sets the mission, the rules you must not break, and the order to read the other plans in.

## Mission

Build a one-stop US website that takes a worker from "pissed off at my boss and don't know what to do" to "winning contract negotiations." It covers rights, organizing coworkers, finding the right union, winning recognition, bargaining a first contract, and running the union afterward. It also ships a toolkit: private tools that run on the worker's own phone, and an end-to-end encrypted Committee Workspace.

## Plan files

| File | What it covers | Read when |
|---|---|---|
| `AGENTS.md` | Mission, hard rules, glossary | Always, first |
| `00-roadmap.md` | Releases R1–R4, ordered task list, gates | Before picking up any task |
| `01-content.md` | Sitemap, page template, voice, section-by-section content briefs, current legal status | Writing or editing any page |
| `02-data-model.md` | Record schemas, union directory, OLMS pipeline, verification | Touching structured data or data-driven pages |
| `03-private-tools.md` | Specs for the on-phone tools (router, matcher, decoder, evidence log, etc.) | Building any `[T]` tool except the workspace |
| `04-workspace-app.md` | Committee Workspace: screens, data model, sync, invites, rooms | R2 templates and R3 app |
| `05-security.md` | Security invariants, threat model, servers, code delivery, protocol lessons, audit scope | Before writing any code that stores, sends or syncs data |
| `06-open-decisions.md` | Decisions reserved for the human owner, research gaps | When you hit something not specified |
| `sources.md` | Every cited source, with tier and URL | When citing anything |
| `data/unions.csv` | Union directory v1 (26 rows) | Data tasks |
| `data/sitemap.txt` | Full page tree, about 90 pages | Routing, IA, content tasks |

## Hard rules

Breaking any of these is a failed task, even if everything else works.

### Scope
1. **US only. Private sector and nonprofits only.** Public-sector (government) workers are out of scope. Where a page could confuse them, add one line pointing them elsewhere, and nothing more.
2. **Edge cases get their own pages, not footnotes:** airlines and rail (Railway Labor Act, National Mediation Board), religious employers, graduate workers, and workers the NLRA doesn't cover (supervisors, independent contractors, agricultural and domestic workers).

### Sources
3. **Every factual claim is sourced from a high-quality labor or pro-labor source.** Use the tiers in `sources.md`:
   - Tier 1 (primary): NLRB, BLS, OLMS.
   - Tier 2 (labor research): EPI, UC Berkeley Labor Center, Cornell ILR.
   - Tier 3 (organizer practice): Labor Notes, EWOC, union training guides.
   - Tier 4 (management-side law firms): **only for tracking what changed in the law, never cited as advice to workers.**
4. **Never invent a fact, URL, statistic, union contact, or legal rule.** If you can't verify it, write `TODO(verify): <what and where to check>` and leave the claim out of published copy.
5. **Union directory data comes only from verified sources** (union websites, OLMS filings). An unverified row must not render as a live link.

### Legal framing
6. **Every legal page carries a "status as of YYYY-MM-DD" stamp** linking to the public changelog (`/rights/whats-changed`). The law is moving fast right now (see `01-content.md` §Legal status).
7. **A "Not legal advice" notice on every legal page,** with links to worker-side lawyers and worker centers (`/help/lawyers`, `/help/worker-centers`).
8. **Legal pages (`[!]` in the sitemap) are drafts until a labor lawyer reviews them.** Mark them `review: pending` in front matter. Never set `review: approved` yourself.

### Voice
9. **Blunt and plain-spoken.** Write for "Joe Schmoe" on a 10-minute break, not for organizers or lawyers. Short sentences. Second person. Define every legal term in plain words the first time it appears. No jargon labels ("assessment level 2"); say "Leaning yes." Honest about risks and odds. See `01-content.md` §Voice.
10. **Spanish at launch** for every page and tool string. Never ship English-only UI text.

### Security (full detail in `05-security.md`)
11. **No server ever holds readable worker data.** No names, ratings, notes, or evidence leave a device unencrypted. This includes analytics, error reports and logs.
12. **No third-party scripts, CDNs, fonts, trackers, analytics, embeds or social widgets** on any page. Self-host everything. Strict CSP.
13. **No accounts.** No email or password sign-up anywhere.
14. **Don't build chat, homemade crypto, dues collection, or authorization-card collection.** Integrate Signal for chat. Use WebCrypto or libsodium. Route cards through the union.
15. **Private tool inputs stay in the browser.** Router answers, matcher inputs and decoder text are never sent to a server.
16. **Every page has Quick Exit** (button plus pressing Esc twice) and shows the work-device warning on first visit.

### Process
17. **Don't decide anything listed in `06-open-decisions.md`.** Stop, write down what you need, and ask the owner.
18. **Human gates in `00-roadmap.md` (lawyer review, security audit, pilot) cannot be marked done by an agent.**
19. When a plan file is silent, choose the option that holds less data, collects less, and is easier for a non-technical worker. Record the choice in `06-open-decisions.md` under "Agent assumptions."

## Definition of done (every task)

- [ ] Meets the acceptance criteria in its plan file.
- [ ] Mobile-first: usable one-handed at 360px wide, on a slow 3G connection.
- [ ] English and Spanish strings present.
- [ ] No new network requests to third parties (check the network panel).
- [ ] Facts cited to `sources.md` IDs; no unverified claim in published copy.
- [ ] Legal pages have an as-of date, the not-legal-advice notice, and `review: pending`.
- [ ] Accessibility: WCAG 2.2 AA, works with a screen reader, no information conveyed by color alone (this matters for the 1–5 rating colors).

## Glossary

| Term | Meaning |
|---|---|
| NLRA / Section 7 | The National Labor Relations Act. Section 7 protects workers acting together ("concerted activity") about pay and conditions, union or not. |
| NLRB | National Labor Relations Board. Runs union elections and handles unfair labor practice charges. |
| ULP | Unfair labor practice. Charges must be filed within 6 months; evidence is now due within 2 weeks of filing. |
| GC memo | Policy memo from the NLRB General Counsel. Signals which precedents the GC wants reversed. |
| RLA / NMB | Railway Labor Act and National Mediation Board. They cover airlines and rail instead of the NLRA and NLRB. |
| OLMS | Office of Labor-Management Standards (Labor Dept.). Publishes union financial reports (LM-2/3/4), persuader reports (LM-20/21) and the e-CBA contract library. |
| Showing of interest | Signatures from at least 30% of the unit, needed to file for an election. Organizers aim for 70% before filing. |
| Cemex | 2023 NLRB decision: after a majority asks for recognition, the employer must recognize the union or file for an election within 2 weeks. Under threat (see legal status). |
| Wall chart | The list of every coworker by department and shift with a 1–5 support rating. The core organizing artifact. |
| 1–5 rating | 1 Strong yes, 2 Leaning yes, 3 Unsure, 4 Leaning no, 5 Against. Always show the words, not just the number. |
| One-on-one | A private organizing conversation: listen, agitate, show a plan, inoculate, ask, follow up. |
| Inoculation | Telling coworkers what the boss will say and do before it happens. |
| Committee | The group of workers organizing the drive. "Core" is the 3–7 most trusted members. |
| EWOC | Emergency Workplace Organizing Committee (DSA + UE). Free volunteer coaching for self-organizing workers. |
| Local-first | Data lives on the user's device and syncs between devices. Servers only relay scrambled data. |
