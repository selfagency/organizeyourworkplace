# Organize Your Workplace: all agent plans

Every plan file in reading order. Updated 2026-10-26.

---

> File: `AGENTS.md`

# AGENTS.md: organizeyourworkplace.com

Read this file first. It sets the mission, the rules you must not break, and the order to read the other plans in.

## Mission

Build a one-stop US website that takes a worker from "pissed off at my boss and don't know what to do" to "winning contract negotiations." It covers rights, organizing coworkers, finding the right union, winning recognition, bargaining a first contract, and running the union afterward. It also ships a toolkit: private tools that run on the worker's own phone, and an end-to-end encrypted Committee Workspace.

## Stack (decided 2026-10-26)

- **Site:** Astro, static output, i18n `en` / `es`.
- **Hosting:** the owner's own Coolify Linux box.
- **Content and config:** private PocketBase `cms`, read at build time only.
- **Encrypted mailbox:** a separate PocketBase `mbx`.
- **Matchmaker:** in-memory, not PocketBase.
- **Errors:** self-hosted GlitchTip.
- **Analytics:** self-hosted Umami, content pages only.

Details and guardrails: `07-stack-and-hosting.md`.

**Operator:** the owner, for now. The goal is handoff to EWOC or a union, so keep everything rebuildable from the repo.

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
| `07-stack-and-hosting.md` | Coolify, Astro, PocketBase, GlitchTip, Umami, leaving-the-site warning, handoff | Any infrastructure, build, analytics or error-reporting task |
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
11. **No server ever holds readable worker data.** No names, ratings, notes, or evidence leave a device unencrypted.
    - Error reports (GlitchTip) and analytics (Umami) are allowed only under the guardrails in `07-stack-and-hosting.md`: no IPs, no query strings, no tool or workspace content, short retention.
    - The workspace sends error reports only when a member taps send.
12. **No third-party scripts, CDNs, fonts, trackers, embeds or social widgets** on any page. Self-host everything. Strict CSP.
    - The only analytics is our own Umami, served first-party, and only on content pages.
    - Never on tools, `/toolkit/*` or the workspace app.
13. **No accounts.** No email or password sign-up anywhere.
14. **Don't build chat, homemade crypto, dues collection, or authorization-card collection.** Integrate Signal for chat. Use WebCrypto or libsodium. Route cards through the union.
15. **Private tool inputs stay in the browser.** Router answers, matcher inputs and decoder text are never sent to a server.
16. **Every page has Quick Exit** (button plus pressing Esc twice) and shows the work-device warning on first visit.
17. **Every link to another site opens the leaving-the-site warning first,** and continues with no referrer (`07-stack-and-hosting.md` §Leaving-the-site warning).
18. **Never promise more privacy than the config delivers.** Privacy copy must match what's deployed, not "we keep nothing."

### Process
19. **Don't decide anything listed in `06-open-decisions.md`.** Stop, write down what you need, and ask the owner.
20. **Human gates in `00-roadmap.md` (lawyer review, security audit, pilot) cannot be marked done by an agent.**
21. When a plan file is silent, choose the option that holds less data, collects less, and is easier for a non-technical worker. Record the choice in `06-open-decisions.md` under "Agent assumptions."
22. **Pin versions** of Astro, PocketBase (pre-1.0; source now at `ganigeorgiev.com/pocketbase/pocketbase`), GlitchTip and Umami. Never auto-upgrade.

## Definition of done (every task)

- [ ] Meets the acceptance criteria in its plan file.
- [ ] Mobile-first: usable one-handed at 360px wide, on a slow 3G connection.
- [ ] English and Spanish strings present.
- [ ] No new network requests to third parties (check the network panel). No Umami request on tool or workspace pages.
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
| RLA / NMB | Railway Labor Act and National Mediation Board. They cover airlines and rail instead of the NLRA and NLRB. Filing for an election needs a 50% showing of interest; a majority of valid ballots cast decides. |
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

---

> File: `00-roadmap.md`

# 00 Roadmap

Four releases, in order. Don't start a release's build tasks until the previous release's agent tasks are done. Human gates (marked 🔒) block **launch**, not development, and only the owner can clear them.

| Release | Ships | Gate to launch |
|---|---|---|
| **R1: Content + private tools** | All 8 sections (EN + ES), router, union matcher, coverage checker, "Is that legal?" decoder, deadline calculator, wallet card, employer research | 🔒 Labor lawyer reviews Rights, Vote and Help |
| **R2: Committee kit** | Self-hosted CryptPad with wall chart, tracker and survey templates; Signal setup guides; retaliation evidence log | 🔒 Server hardening review, privacy policy, legal-request policy |
| **R3: Workspace app** | Local-first wall chart, peer-to-peer sync + encrypted mailbox, need-to-know rooms, one-time invites, majority meter, union handoff export | 🔒 Independent security audit; 🔒 pilot with 3–5 real committees via EWOC or partner unions |
| **R4: After the win** | Bargaining survey builder, contract compare, grievance tracker, run-your-union guides | 🔒 Feedback from R3 committees that won |

Rationale: R2 lets committees work securely without you writing any encryption code. Build R3 only after real committees prove the design.

---

## R0: Foundations (do first)

Stack and hosting details for every R0 task: `07-stack-and-hosting.md`.

- [ ] **R0.0 Coolify box.** Hardening H1–H7 in `07-stack-and-hosting.md`: dashboard behind VPN, neutral subdomains, proxy access logs off, backups, everything as code.
  - Accept: grep the box for a test IP and get zero hits outside the SSH auth log.
- [ ] **R0.1 Astro skeleton.** Static output, telemetry off, self-hosted fonts, no remote images, prefetch off (A1–A3). Strict CSP header template (see `05-security.md` §Web hardening).
  - Accept: `curl -I` shows CSP, HSTS, `Referrer-Policy: no-referrer`, `Permissions-Policy`; the network panel shows only first-party requests.
- [ ] **R0.2 i18n.** Astro i18n with `en` (default, unprefixed) and `es` (`/es/...`). String catalogs for all UI, and a language switcher that keeps the same page.
- [ ] **R0.3 Global chrome.** Top nav (8 items), red "Boss retaliating? →" button, Quick Exit (button + Esc×2), first-visit work-device banner, **leaving-the-site warning** (L1–L6), footer. Spec: `01-content.md` §Global chrome.
- [ ] **R0.4 Content schema + page templates.** Front matter fields in `01-content.md` §Page template. Legal pages render the as-of stamp, not-legal-advice notice and changelog link automatically.
- [ ] **R0.5 PocketBase `cms` + data layer.** Private instance (P1–P5), collections mirroring `02-data-model.md`, an Astro build-time loader, Zod validation, nightly git export, and a publish → rebuild webhook (A4, A6, A7). The build fails on invalid records.
- [ ] **R0.6 Changelog.** `/rights/whats-changed`, generated from legal-rule records' `history` field.
- [ ] **R0.7 GlitchTip.** Private dashboard, 14-day retention, first-party `/e/` tunnel that strips IPs, SDK scrubbing (G1–G5, G7).
  - Accept: a test error arrives without an IP, query string or breadcrumbs.
- [ ] **R0.8 Umami.** First-party `/s/` path, content pages only, no events, DNT/GPC honored, opt-out link, 30-day raw retention (U1–U6).
  - Accept: no Umami request fires on `/toolkit/*`, tool pages or `app.`.
- [ ] **R0.9 Handoff runbook** (O1, O2). Keep it current with every infrastructure change.

## R1: Content + private tools

### Content (`01-content.md`)
- [ ] R1.1 Start Here: router page, 8-stage roadmap, honest risks, Union 101.
- [ ] R1.2 Your Rights (all `[!]`): Section 7, TIPS/FOE, coverage sub-pages, state laws, legal tracker.
- [ ] R1.3 Organize: first conversation, listening, mapping, leaders, committee, inoculation, fear, actions, security (+3 sub-pages), high turnover, remote.
- [ ] R1.4 Find a Union: matcher page, sector pages, union and local profiles (generated), how to pick, first call, independent, no union yet.
- [ ] R1.5 Win the Vote (all `[!]`): cards, recognition, petition, the unit, boss campaign, captive meetings, answers to top 15 boss arguments, election day, timeline.
- [ ] R1.6 Win the Contract: first contract, survey, demands, bargaining committee, campaign/escalation, strikes `[!]`, compare.
- [ ] R1.7 Run Your Union: bylaws, officer elections `[!]`, dues and money `[!]`, stewards, grievances, keep organizing.
- [ ] R1.8 Make the Case: talking points, numbers, myths, stories.
- [ ] R1.9 Get Help (all `[!]`): retaliation (do-this-today), file a charge, NLRB office finder, lawyers, worker centers.
- [ ] R1.10 About: sources and methods, source tiers, changelog, privacy (honest version: page counts without IPs, error reports kept 14 days, tools and workspace never counted; see `07-stack-and-hosting.md` U6, G7), corrections form (no account; see `05-security.md`).
- [ ] R1.11 Spanish versions of everything above (confirmed by the owner). An agent drafts; a human fluent in labor Spanish reviews every `[!]` page before it goes live. Who reviews is still open (`06-open-decisions.md` #8).

### Data (`02-data-model.md`)
- [ ] R1.12 Verify every `TO VERIFY` row in `data/unions.csv`.
- [ ] R1.13 Build the OLMS local-level dataset (bulk download → `locals.json`).
- [ ] R1.14 Sector records with plain-language job lists.
- [ ] R1.15 Legal-rule and state-law records (start from `01-content.md` §Legal status).
- [ ] R1.16 Help-resource records (NLRB regional offices, worker centers, lawyer directories).

### Tools (`03-private-tools.md`)
- [ ] R1.17 Router. R1.18 Coverage checker. R1.19 Union matcher. R1.20 "Is that legal?" decoder. R1.21 Conversation builder. R1.22 Deadline calculator. R1.23 Wallet card. R1.24 Employer research. R1.25 Election timeline calculator. R1.26 Inoculation builder.

### Gate
- [ ] 🔒 R1.G Lawyer review of every `[!]` page. Agent task: produce `review-packet.md` listing each page, its claims, and their sources.

## R2: Committee kit

- [ ] R2.1 CryptPad deployment plan (subdomain `pad.`), hardening checklist, backup policy. **Don't deploy without the owner's go** (`06-open-decisions.md` #2).
- [ ] R2.2 CryptPad templates: wall chart spreadsheet, one-on-one tracker board, issue board, action planner, bargaining survey form, meeting notes. Spec: `04-workspace-app.md` §R2 templates.
- [ ] R2.3 Signal guides: setup with username, disappearing messages, group templates (Committee, Trusted contacts), admin approval, what to do if a phone is taken.
- [ ] R2.4 Retaliation evidence log (`03-private-tools.md` §Evidence log).
- [ ] R2.5 Privacy policy and legal-request policy drafts → owner and lawyer.
- [ ] 🔒 R2.G Server hardening review.

## R3: Workspace app (`04-workspace-app.md`, `05-security.md`)

- [ ] R3.0 Paper prototype of screens 1–4 → 5 usability sessions with non-organizers (human-run; the agent prepares scripts and prototypes).
- [ ] R3.1 Threat model doc and protocol whitepaper draft (publish before launch).
- [ ] R3.2 Local storage layer (encrypted IndexedDB, persistence request, iOS Home Screen gate).
- [ ] R3.3 Data model on Yjs (Automerge as fallback); evaluate existing encrypted Yjs sync servers first. Edits are deniable: MAC with the room key, no per-device signatures (`05-security.md` §Deniable edits).
- [ ] R3.4 Keys and invites (one-time, device-bound, 4-word check code).
- [ ] R3.5 Rooms (Core / Point person / Committee) and the permissions matrix.
- [ ] R3.6 Servers on Coolify:
  - matchmaker: in-memory, never PocketBase;
  - relay: TURN;
  - mailbox: PocketBase `mbx`, logs off, committee-chosen retention of 1 week / 2 weeks / 1 month (P6–P11).
- [ ] R3.6b Opt-in error reports from the workspace, with a preview of exactly what's sent and a canary test (G6).
- [ ] R3.7 Removal + re-key; 2-of-3 recovery; encrypted backups.
- [ ] R3.8 Screens 0–11.
- [ ] R3.9 Union handoff export: Action Builder CSV and Broadstripes XLSX/CSV, spec in `04-workspace-app.md` §Hand-off export formats. Test both with a friendly organizer's sandbox project before launch.
- [ ] R3.10 Code delivery: pinned updates, signed releases, transparency log, reproducible build.
- [ ] R3.11 (Post-R3) Optional remoteStorage destination for encrypted backups (`05-security.md` §Device storage and iOS).
- [ ] 🔒 R3.G1 Independent security audit (scope in `05-security.md` §Audit scope).
- [ ] 🔒 R3.G2 Pilot with 3–5 committees.

## R4: After the win

- [ ] R4.1 Bargaining survey builder (trade-off questions; response rate by department).
- [ ] R4.2 Contract compare (OLMS e-CBA search by industry).
- [ ] R4.3 Grievance tracker (deadline calendar from contract timelines, steward assignments).
- [ ] R4.4 Run Your Union guides (already drafted in R1.7; update with R3 pilot feedback).
- [ ] Don't build dues collection.

---

> File: `01-content.md`

# 01 Content

How to write and structure every page. The full page tree is in `data/sitemap.txt`. Facts below were checked on **2026-10-26**. Re-verify anything legal before publishing; the NLRB is actively reversing precedent.

## Global chrome (every page)

- **Top nav, in campaign order:** Start Here · Your Rights · Organize · Find a Union · Win the Vote · Win the Contract · Run Your Union · Toolkit.
- **Secondary sections outside the nav:**
  - *Make the Case* (`/case`), linked from every Organize and Vote page.
  - *Get Help* (`/help`), reached from a red **"Boss retaliating? →"** button on every page.
- **Quick Exit:** a visible button plus pressing Esc twice. It replaces the current tab with a neutral site using `location.replace()`, so Back doesn't return here. The pattern comes from domestic-violence hotline sites.
- **First-visit banner:** "On a work laptop, work phone, or work Wi-Fi? Close this and come back on your own phone." Many company devices can be monitored remotely by IT [A1]. Remember dismissal in `localStorage` only.
- **Footer:**
  - Not legal advice
  - Privacy
  - Sources & methods
  - Changelog
  - Español
  - Turn off counting
- **Privacy line in the footer:** "We count page visits without cookies or your IP address. The tools and the workspace are never counted." Copy must match the deployed config (`07-stack-and-hosting.md` U6, G7).
- **Leaving-the-site warning:** a modal before any link to another domain. Spec and copy: `07-stack-and-hosting.md` L1–L6.
  - **Spanish title:** "Estás saliendo de Organize Your Workplace."
  - Agent draft; it needs human review like all `[!]`-adjacent copy.
- **Mobile-first, low-bandwidth.** Most readers are on a phone during a break. Target under 100 KB per content page, no web fonts over 50 KB total, and no images without a purpose.

## Nav map: the worker's question at each stage

| Nav item | Worker's question | Key pages |
|---|---|---|
| Start Here | "I'm pissed. Now what?" | Router, the 8 stages, honest risks |
| Your Rights | "Can they fire me for this?" | Section 7, TIPS/FOE, coverage checker, state laws, what's changed |
| Organize | "How do I bring this up with coworkers?" | First conversation, mapping, leaders, committee, inoculation, security, high-turnover and remote shops |
| Find a Union | "Who do we call?" | Union matcher, sector pages, union and local profiles, how to vet a union, going independent |
| Win the Vote | "How do we actually win?" | Cards, petition, bargaining unit, the boss's campaign decoded, answers to the boss's arguments, timeline |
| Win the Contract | "We won. Why don't we have a contract?" | Bargaining survey, demands, escalation ladder, strikes, real contracts |
| Run Your Union | "How do we keep this going?" | Bylaws, officer elections, dues and federal reports, stewards, grievances |
| Toolkit | "Give me something I can use." | Index of every tool |

## Page template

Front matter for every content page:

```yaml
title: "You're protected even without a union"
slug: /rights/section-7
section: rights            # start|rights|organize|unions|vote|contract|run|case|toolkit|help|about
stage: 1                   # 1-8 position on the roadmap, or null
legal: true                # true for every [!] page
status_as_of: 2026-10-26   # required when legal: true
review: pending            # pending|approved; only the owner sets approved
sources: [P1-6, A16]       # IDs from sources.md
related_tools: [coverage-checker, wallet-card]
next_steps:                # renders as the "Your next 3 steps" card
  - { text: "Check if you're covered", href: /rights/am-i-covered }
lang: en
translation_of: null       # the English slug, on Spanish pages
```

Body structure:
1. **One-line answer** in bold (the BLUF).
2. **What this means for you**, in 3–6 short paragraphs or bullets.
3. **What to do now:** numbered steps.
4. **Watch out:** risks, edge cases, "this is changing."
5. **Your next 3 steps** card (from front matter).
6. Sources (rendered from IDs).

Legal pages also render, automatically and above the body: a "Status as of {date} · What's changed →" stamp, and a "Not legal advice. Talk to a worker-side lawyer or worker center →" notice.

## Voice

- **Blunt, plain, encouraging.** "Your boss can't fire you for this. Here's how to prove it if they try."
- **Second person, short sentences,** grade 6–8 reading level. Run a readability check on every page.
- **Honest about odds.** Don't promise that the law protects you. Say it is a weak deterrent and that strength in numbers is the real protection.
- **Define on first use.** "An unfair labor practice charge (a complaint to the NLRB that your boss broke labor law)…"
- **No jargon labels.** Use Strong yes / Leaning yes / Unsure / Leaning no / Against, not "1s and 2s," in worker-facing copy (the tools may show both).
- **Not preachy.** Never name a political party. Describe what the Board did, not who is to blame.
- **Spanish copy is written for the same reader,** not a literal translation. Use Labor Notes' Spanish handouts as a terminology reference.

## Legal status (as of 2026-10-26)

**The headline for the site:** the law is shifting against organizers right now, so teach workers to win through majority strength, not legal shortcuts.

- **The Board's makeup.** The Board regained its quorum on Jan 7, 2026. The Senate confirmed James Macy on Aug 7, giving Republicans 3 votes, the number the Board traditionally needs before it overturns precedent [P1-1].
- **GC targets.** General Counsel Crystal Carey's memo GC 26-04 (Aug 26) lists 13 decisions she wants reversed [P1-2].

| Rule | Status now | What the site tells workers |
|---|---|---|
| **Cemex (2023):** after a card majority, the employer must recognize the union or file for an election within 2 weeks | Still Board law; the GC plans to challenge it. The 6th Circuit struck it down in *Brown-Forman* (Mar 2026), so it isn't reliable in MI, OH, KY or TN [P1-3]. | Don't plan on a bargaining order. Build a majority big enough to win an election anyway. |
| **Captive-audience ban** (*Amazon*, 2024) | Still law; the GC has filed to overturn it [P1-4]. | Assume mandatory anti-union meetings are coming. Prepare coworkers in advance. |
| **Limits on employer "predictions"** (*Siren Retail*) | Targeted for reversal | Expect "we might close" talk. Teach the answer. |
| **Handbook rules** (*Stericycle*), **severance gag clauses** (*McLaren Macomb*) | Targeted. Regions have been told to deprioritize rule-only cases. | Talking about pay and conditions is still protected. Don't count on a handbook rule being thrown out. |
| **Expanded money remedies** (*Thryv*) | Rejected by several appeals courts; targeted | If you're fired illegally, expect back pay and reinstatement, slowly. |
| **ULP charge intake** | New since late 2025: evidence (timeline, witnesses, documents) is due within 2 weeks of filing [P1-5] | Keep notes from day one, on a personal device. |
| **E-signature authorization cards** (GC 15-08, 2015) | Allowed, with specific required fields [A8]: the signer's name, email or social account, phone, the authorization language, the date and the employer. GC 25-05 targeted the previous GC's memos, and the published lists of what it rescinded don't include 15-08 [A48]. `TODO(verify)` against the memo text. | Sign cards through the union's process. |
| **Election timeline** (2023 rule, 88 FR 58076) | In effect since Dec 26, 2023. Hearings are scheduled faster, and the 20-business-day wait between the decision and the election is gone. No rescission had been published as of 2026-10-26 [A49]. | Elections can come fast after filing. Have your majority and your inoculation done before you file. |
| **GC 25-05** (2025) | Rescinded GC 22-04 (the captive-audience memo) and more than a dozen other worker-friendly memos [A46]. Management-side firms expect the Board to reverse *Amazon*, *Siren Retail*, *Stericycle*, *Lion Elastomers*, *McLaren Macomb*, *Cemex*, *American Steel*, the blocking-charge rules and the 2023 election rule [A45]. | Every legal page shows its as-of date. Check "What's changed" before you rely on a rule. |
| **State captive-audience bans** | 12 states ban mandatory anti-union meetings: AK, CA, CT, HI, IL, ME, MN, NJ, NY, OR, VT and WA. Employers have sued in several (CA, IL, OR, CT); some laws are on hold pending those cases [A44]. | Name your state's law, but say plainly that it may be blocked. Check the state page's as-of date. |
| **Airlines and rail (RLA)** | Filing with the NMB needs a 50% showing of interest [A42]. The union wins with a majority of valid ballots cast [A43]. | Your bar to file is higher than under the NLRA (50%, not 30%). Aim for a big majority first. |

**What hasn't changed:**
- Section 7 still protects talking with coworkers about pay and conditions, union or not.
- You have 6 months from the violation to file a ULP charge.
- An election petition needs a showing of interest from 30% of the unit. Organizers advise reaching 70% first [P1-6].
- Weingarten rights (bringing a representative into a disciplinary meeting) apply only once you have a union.

**Union finance reporting (Run Your Union):** for fiscal years starting July 1, 2026, a union with receipts under $25,000 files the LM-4; $25,000–$350,000 files the LM-3; $350,000 and up files the LM-2 [A5]. Local officers must be elected by secret ballot at least every 3 years.

**`TODO(verify)` before publishing:**
- GC 15-08's status, checked against the GC 25-05 memo text.
- Which state captive-audience laws are currently enjoined (check each case docket; e.g. *Illinois Policy Institute v. Flanagan*, N.D. Ill. 1:24-cv-06976).
- NLRB jurisdiction thresholds (believed: $500k gross for retail, $50k interstate inflow/outflow for nonretail) and current election timelines. Confirm on nlrb.gov.

## Coverage

- **In scope:** private-sector and nonprofit employees, once the employer meets the NLRB's dollar thresholds. Nonprofits are judged by the same standards as for-profit businesses. For example, NPEU represents staff at more than 50 organizations, including the ACLU, Brookings and the Urban Institute [P1-7].
- **Edge-case pages** (`/rights/am-i-covered/*`):
  - **Airlines and rail:** Railway Labor Act, NMB, different rules.
  - **Religious employers:** can claim exemption.
  - **Grad workers:** status rests on precedent the new majority may revisit.
  - **Supervisors, contractors, agricultural and domestic workers:** no NLRA protection. Their routes are worker centers, direct action and state law.

## Section briefs

### Start Here (`/start`)
- **Router:** spec in `03-private-tools.md`.
- **The 8 stages:** a visual roadmap, zero to contract, where each stage links to its section. Proposed stage names (not yet confirmed; log in `06-open-decisions.md`): Get angry → Talk to coworkers → Build a committee → Find a union → Go public/sign cards → Win the vote → Win the contract → Run the union.
- **Is it worth it?** Give the honest costs, risks and odds, plus the payoff:
  - union median weekly pay is $1,404 vs. $1,174 nonunion;
  - the union wage premium is 12.8% for the same job, education and experience;
  - the private-sector union rate is 5.9% (10.0% overall, 2025);
  - 43% of nonunion workers, about 56M people, say they'd vote yes [P1-12].
- **Union 101:** what a union is and isn't.

### Your Rights (`/rights`) `[!]`
- **Section 7:** you're protected even without a union.
- **TIPS:** what the boss can't do (Threaten, Interrogate, Promise, Spy).
- **FOE:** what the boss can do (Facts, Opinions, Examples), and how to answer each.
- Coverage checker plus the edge-case pages above.
- State laws (data-driven).
- What's changed (the changelog).

### Organize (`/organize`)
- **Core method: lead with problems, not the word "union."** UFCW advises against opening with "I'm thinking about starting a union" unless you trust the person. Ask about hours, pay and safety, and ask what they like about the job, because that's what a contract would protect [P1-6].
- **The conversation sequence:** Listen → Agitate (why it matters to them) → Show a plan → Inoculate → Ask for one specific commitment → Follow up.
- **Source handouts** (Labor Notes, *Secrets of a Successful Organizer*, free online in EN and ES). Adapt them with attribution and link back; don't copy them wholesale:
  - An Organizing Conversation;
  - How to Be a Good Listener;
  - Inoculate Your Co-Workers Against the Boss's Tactics;
  - Ten Questions to Ask When Mapping Your Workplace;
  - When You're Called Into the Office.
- **Mapping:** wall chart basics; links to the Committee Workspace.
- **Leaders:** natural leaders aren't the loudest people; they're the ones coworkers go to.
- **Security** (`/organize/security`) `[!]`: build on EFF Surveillance Self-Defense, especially its security-plan exercise, rather than writing from scratch.
  - Never use company Slack, email or devices.
  - Sub-pages: Signal setup, docs and files, if your phone is taken.
- **High turnover:** organize across employers. USSW organizes by city because fast-food turnover tops 150% a year, using escalating direct action: button days, petition deliveries, walkouts [P1-10].
- **Remote and hybrid workplaces:** `TODO(research)`.

### Find a Union (`/unions`) `[D]`
- Sector pages and profiles are generated from data (`02-data-model.md`). List unions neutrally, with recent wins as proof each one is actively organizing.
- **"I don't know which union":**
  - EWOC gives free volunteer coaching and has heard from 5,000+ workers since 2020 [P1-8].
  - The AFL-CIO routes inquiries to the right affiliate [P1-9].
- **Going independent** (e.g. Trader Joe's United, Blue Bottle Independent Union): more control, but no strike fund or staff lawyers.
- **How to pick:** 10 questions to ask a union.
- **First call:** what happens when you call an organizer.

### Win the Vote (`/vote`) `[!]`
- Cards; recognition; petition (30% minimum, 70% rule of thumb); the unit; election day.
- The union-busting playbook, decoded (links to the decoder tool).
- Captive meetings.
- **Answers to the boss's top 15 arguments** (dues, strikes, "third party," "we're a family," closure threats, etc.). `TODO(draft)`.
- Timeline calculator.

### Win the Contract (`/contract`)
- **Blunt line:** winning the election isn't the finish line. Nearly 700 Starbucks stores have won elections and still have no contract [P1-11].
- **Survey guidance from Labor Notes:** ask trade-off questions ("split a dollar between wages and retirement") instead of "what are your top issues," and track response rate by department [A4].
- Escalation ladder, from buttons to strikes.
- Strikes `[!]`: ULP vs. economic strikes, strike funds.
- Compare real contracts (OLMS e-CBA).

### Run Your Union (`/run`)
- Bylaws templates; officer elections `[!]`; dues and LM reports `[!]`.
- Stewards and Weingarten rights.
- Grievances; keep organizing.
- **Don't build dues collection.** Point new unions to existing membership software.

### Get Help (`/help`) `[!]`
- **`/help/retaliation`:** "Fired or punished? Do this today."
  - Write everything down now.
  - Note the 2-week evidence window and the 6-month filing deadline.
  - Link to the deadline calculator and evidence log.
- File a charge, step by step.
- NLRB regional office finder.
- Lawyers and worker centers (data-driven).

### Make the Case (`/case`)
- Talking points by issue: pay, safety, scheduling, respect.
- Union advantage data by industry, from BLS and EPI [P1-12].
- Myths; worker stories by industry.

## Content research backlog

- [ ] Draft answers to the boss's top 15 arguments.
- [ ] First-contract timelines, bargaining surveys, strike basics (phase 6).
- [ ] Remote and hybrid organizing.
- [ ] State-law table: the captive-audience list is done (see §Legal status); add per-state litigation status.
- [x] RLA rules for airline and rail pages (50% to file, majority of ballots cast).

---

> File: `02-data-model.md`

# 02 Data model

Store unions, locals, legal rules and sources as structured records, not prose. Sector pages, union profiles, the union matcher, the changelog and the help directories are all generated from these records, so one update fixes every page that uses it.

**Where records live:**
- Editors work in the private PocketBase `cms` instance. Each record type below is one collection, plus `status`, `last_checked` and version history.
- Astro pulls published records at build time and validates them with Zod schemas that mirror the definitions here.
- A nightly job exports them to `data/*.json` in the repo for review and handoff. The repo export is the source of truth if PocketBase fails.
- The build fails on any invalid record.
- Details: `07-stack-and-hosting.md` P1–P5 and A4–A7.

## Records

### `union`
| Field | Type | Notes |
|---|---|---|
| `id` | slug | `uaw`, `npeu` |
| `name`, `abbreviation` | string | |
| `affiliation` | string | AFL-CIO, independent, SEIU affiliate… |
| `sectors` | sector id[] | |
| `who_they_organize` | string | Plain language |
| `organizing_intake` | url \| null | **Only if verified.** Unverified intake renders as "Contact via EWOC or the AFL-CIO." |
| `local_finder` | url \| null | |
| `recent_wins` | campaign id[] | Proof the union is actively organizing |
| `membership`, `finances` | object | From OLMS LM-2 |
| `olms_file_number` | string | Join key to OLMS |
| `status` | enum | `verified`, `partially_verified`, `to_verify` |
| `last_checked` | date | |
| `sources` | source id[] | |

### `local`
`id`, `number`, `parent_union`, `name`, `city`, `state`, `address`, `membership`, `sectors`, `organizing_active` (bool: true only if the union's site shows the local organizing), `olms_file_number`, `fiscal_year`, `last_checked`.

### `sector`
`id`, `name`, `plain_jobs` (e.g. "baristas, line cooks, servers"), `unions` (ranked by organizing activity), `union_density` (BLS), `notes`.

### `legal_rule`
`id`, `rule`, `plain_summary`, `status` (`in_force` | `targeted` | `split_by_circuit` | `overturned`), `where_it_applies` (all, or circuits/states excluded), `status_as_of`, `citation`, `what_to_tell_workers`, `history[]` ({date, change, source}). The `history` field generates `/rights/whats-changed`.

### `state_law`
`state`, `topic` (e.g. `captive_audience_ban`), `status`, `effective`, `citation`, `status_as_of`.

### `campaign`
`employer`, `union`, `sector`, `outcome`, `year`, `link`, `source`.

### `source`
`id` (matches `sources.md`), `title`, `publisher`, `tier` (1–4), `date`, `url`.

### `help_resource`
`type` (`lawyer` | `worker_center` | `nlrb_office` | `legal_clinic`), `name`, `area_served`, `languages`, `contact`, `source`, `last_checked`.

## Union directory v1

`data/unions.csv` has 26 rows. Its columns map to `union`: `sector, union, abbreviation, affiliation, who_they_organize, organizing_intake, local_finder, recent_example, status, last_checked`.

| Sector | Main unions | How to reach an organizer |
|---|---|---|
| Nurses | NNU, SEIU, NUHW | NNU intake form |
| Hotels, casinos, stadiums, airport and campus food | UNITE HERE | Local finder by state |
| Coffee and restaurants | Workers United (SEIU), UFCW, Teamsters, independent | Starbucks Workers United |
| Grocery, retail, cannabis | UFCW, RWDSU | UFCW organizer contact |
| Warehouse, delivery, Amazon | Teamsters | Find a local + organize form |
| Autos, manufacturing | UAW, USW, IAM, UE | UAW organizing contact |
| Private universities | UAW, SEIU, AFT, UE | UAW Higher Ed contact |
| Policy and advocacy nonprofits | NPEU (IFPTE), NEU (OPEIU), NewsGuild-CWA | NPEU contact |
| Social services, housing, refugee work | NEU (OPEIU), SEIU | NEU site |
| Tech, games, media | CWA (CODE-CWA, NewsGuild) | TO VERIFY |
| Southern service jobs | USSW (SEIU) | ussw.org |
| Any, unsure | EWOC; AFL-CIO referral | workerorganizing.org/support; aflcio.org/contact-union-organizer |

Most industries have 2–3 plausible unions, and their jurisdictions overlap. **List them neutrally. Don't rank by the agent's opinion.** Rank by verified organizing activity (recent petitions and wins), and show the evidence.

## Tasks

- [ ] **D1 Import** `unions.csv` into the `cms` `unions` collection, and add `id`, `sectors[]`, `sources[]`.
- [ ] **D2 Verify intake links.**
  - **Progress as of 2026-10-26:** 23 rows verified or partly verified, including USW, IAM, CODE-CWA, NewsGuild, UNITE HERE, RWDSU, NUHW, UE, IATSE, Equity and WGA East.
  - **Still to verify:** SAG-AFTRA (site blocks our fetcher), SEIU building services and national intake, and the NABTU route. Equity and WGA East added 2026-10-26.
  - **Resolve:** the exact SEIU intake URL, and the AFSCME CWU contact form.
  - **Finish:** the airline rows (partly verified).
  - Method: open the union's official site and find the organizing or "start a union" page.
  - Record the URL, the date, and a one-line description of the form.
  - Don't use third-party listicles.
  - Accept: the row's status is `verified`, with `last_checked` set; otherwise it stays `to_verify` and its link doesn't render.
- [ ] **D3 OLMS locals pipeline.**
  - Download the OLMS Union Search yearly bulk file.
  - Parse it into `local` records: name, number, address, membership, parent union, file number.
  - Join to `union` on the affiliation code.
  - Overlay `organizing_active` from union sites (e.g. the Teamsters and UNITE HERE local finders).
  - Re-run yearly.
  - Accept: a script that is reproducible from the raw file; a row count per parent union; a spot check of 20 random locals against the OLMS site.
- [ ] **D4 Persuader data** for the employer research tool: OLMS LM-20/LM-21 reports (union-busting consultants hired by employers). Index them by employer name, with fuzzy matching.
- [ ] **D5 e-CBA index** for contract compare: the OLMS contract library, by industry and employer.
- [ ] **D6 Sector records** with plain-language job lists and BLS union density.
- [ ] **D7 Legal-rule records** seeded from `01-content.md` §Legal status, each with `history[]`.
- [ ] **D8 Help resources:** NLRB regional offices (Tier 1), worker centers, worker-side lawyer directories.
- [ ] **D9 Freshness job:** flag any record with `last_checked` older than 90 days (30 days for `legal_rule`) in a build report.

## Data hygiene

- No personal data about workers, ever, in `data/`.
- Union officer names only when they come from OLMS public filings, and only on profile pages.
- Corrections from the public go through an editor queue (no accounts; see `05-security.md`) and appear in the changelog.

---

> File: `03-private-tools.md`

# 03 Private tools

These tools run entirely in the browser.
- No account.
- No server calls with user input.
- Nothing is stored on the site's server.

They ship in R1 (the evidence log ships in R2).

## Shared requirements

- **Inputs never leave the device.** No `fetch`/XHR/beacon carries user input. Static data (unions, rules) is bundled at build time or fetched as whole files that don't depend on the user's answers. Fetching `/data/unions-CA.json` because the user picked CA leaks their state to the server log, so bundle the full dataset or fetch everything.
- **State lives in memory by default.** Persist to `localStorage`/IndexedDB only where a tool says so. A "Clear everything" control is always visible.
- **Works offline** after the first load (service worker caches tools and data).
- **EN/ES strings,** plain labels, one-handed use at 360px.
- **Unit tests for every rule and date calculation.** Legal logic lives in data (`legal_rule` records), not hard-coded.
- **Every result screen ends with "Your next 3 steps."**
- **No analytics or automatic error reports on tool pages.** No Umami script; GlitchTip only through an explicit "Report a problem" button that sends no inputs (`07-stack-and-hosting.md` U1, G4).
- **Links out** (union intake forms, NLRB, EWOC) go through the leaving-the-site warning.

---

## T1 Router (`/start`)

Six questions → the right stage + "Your next 3 steps."

1. What do you do, and what kind of employer is it (company, nonprofit, airline/rail, church-run, government)?
2. Roughly how many coworkers do you have?
3. Have you talked to any of them about it?
4. Has anyone been punished for speaking up?
5. Is there already a union, or a union drive?
6. What state are you in?

**Routing rules:**
- **Q4 = yes → go straight to `/help/retaliation`,** skipping everything else, because the 6-month ULP clock is running.
- Government → a one-line out-of-scope message + external resources.
- Airline/rail → `/rights/am-i-covered/airlines-rail`.
- Church-run → `/rights/am-i-covered/religious-employers`.
- Existing union → `/run/stewards` + `/rights` (Weingarten).
- Haven't talked to anyone → `/organize/first-conversation`.
- Talked to a few, no committee → `/organize/committee` + `/organize/map-your-workplace`.
- Committee exists → `/unions` matcher, pre-filled.

**EWOC handoff:** the result screen offers "Get a free organizer coach" with the worker's answers formatted to paste into EWOC's form (name, mobile, email, ZIP, workplace, headcount, union yes/no, what's going on, up to 3,000 chars) [A16]. **Copy to the clipboard only. Never submit on the worker's behalf.**

**Accept:** every path is covered by a test; Q4 = yes always wins; no network request carries answers.

## T2 Coverage checker (`/rights/am-i-covered`)

Sorts the worker into: **NLRA covered** · **Railway Labor Act** · **likely exempt** (religious employer, small employer under the NLRB thresholds) · **not covered** (supervisor, contractor, agricultural, domestic, government). Each outcome gives next steps. "Not covered" points to worker centers, direct action and state law. Note uncertain cases ("you might be misclassified as a contractor"). `TODO(verify)`: the NLRB's current jurisdictional dollar thresholds.

## T3 Union matcher (`/unions`)

Industry + state + job → unions organizing that work, nearby locals (from `local` records), recent wins, and how to reach them.
- Neutral ordering by verified organizing activity, with the evidence shown.
- Unverified intake links don't render. Fall back to EWOC / AFL-CIO referral.
- Always show the "Don't know which union?" and "Going independent" options.

## T4 "Is that legal?" decoder (`/vote/boss-campaign`)

The worker picks or types what a manager said or did. The decoder returns **probably illegal / legal but misleading / legal**, why, how to respond, and whether to log it as evidence.
- Seed the library from TIPS (Threaten, Interrogate, Promise, Spy) and FOE (Facts, Opinions, Examples). Examples: "We might have to close." "Who's behind this?" A mandatory meeting. A raise announced mid-campaign.
- Each entry links to a `legal_rule` and shows its as-of status. The captive-audience entry must reflect that the ban is under challenge.
- Free text is matched locally against keywords and synonyms. **No AI API call, no server.**
- Footer: not legal advice; link to file a charge.

## T5 Conversation builder (`/organize/first-conversation`)

From the worker's issues, it generates a personal first-conversation script following the sequence Listen → Agitate → Plan → Inoculate → Ask → Follow up:
- an opener question about the problem, not the word "union";
- follow-ups to go deeper;
- a plan sentence;
- an inoculation line;
- one specific ask.

Practice mode shows prompts one at a time with tips. It is adapted from the Labor Notes conversation handout (attribute it).

## T6 Inoculation builder (`/organize/inoculation`)

Pick the employer's likely moves (captive meetings, "third party," dues scare, sudden raises, closure talk, one-on-ones with supervisors). It outputs a short "here's what they'll say, here's the truth" sheet to share in person. Nothing is shared digitally.

## T7 Deadline calculator (`/toolkit/deadlines`)

- **From an incident date:**
  - the ULP filing deadline (6 months, per Section 10(b));
  - a reminder that evidence is due within 2 weeks of *filing*;
  - a recommended file-by date with buffer.
- **From a petition date:** an estimated election window. `TODO(verify)`: the current NLRB election-rule timelines before coding them.
- **Export:** an `.ics` file generated locally. No calendar API.
- **Accept:** date math tested across month ends, leap years and time zones; every result shows "Estimate. Confirm with the NLRB regional office."

## T8 Election timeline calculator (`/vote/timeline`)

Petition → hearing → election → certification, with typical ranges and the Cemex caveat by circuit. Data-driven from `legal_rule`.

## T9 Wallet card (`/toolkit/wallet-card`)

A printable, foldable know-your-rights card, plus a "called into the office" card (adapted from Labor Notes' "When You're Called Into the Office"). Print CSS, EN/ES, and an optional local NLRB office (picked from data, not geolocation).

## T10 Employer research (`/toolkit/research-employer`)

Enter an employer to see:
- persuader filings (LM-20/21: union-busting consultants it has hired);
- NLRB case history;
- OSHA citations;
- for nonprofits, executive pay from IRS Form 990s next to typical staff pay. This is the strongest feature for nonprofit drives.

**Privacy problem to solve:** querying live APIs from the browser leaks the employer name to those sites, and to our server if proxied. Options, in order of preference:
1. Bundle pre-built indexes (persuader, NLRB cases) and search them locally.
2. Open the official search pages in a new tab with the query, and tell the user the official site will see the search.
3. Never proxy through our server.

Record the choice in `06-open-decisions.md`.

## T11 Retaliation evidence log (`/toolkit/evidence-log`, R2)

Records incidents: date and time, what happened, who did it, witnesses, photos and files.
- **Storage:** encrypted on the device (IndexedDB plus WebCrypto AES-GCM, with the key derived from a passphrase via PBKDF2 or Argon2).
- **Tamper-evident:** each entry is signed and includes the hash of the previous entry. Export includes the chain, so the worker can show nothing was backdated or edited.
- **Export:** an NLRB-ready timeline (PDF/print view + JSON), generated on the device. It supports the 2-week evidence deadline.
- **Lock:** a passphrase, auto-lock, and a panic wipe (one tap, with confirmation).
- **Optional disguise** as a neutral app. Tella is the model [A19]. **Test it with real users:** a Tella user was locked out because its calculator disguise dropped the leading zero of their PIN.
- **Backups:** an encrypted file saved to the user's own storage.
- **No cloud sync** in the private version. Sharing into the committee's evidence locker is an explicit export into the workspace (R3).

**Accept:**
- Tampering with an exported entry fails verification.
- The wipe removes all keys and data, verified by inspecting IndexedDB.
- Works fully offline.

---

> File: `04-workspace-app.md`

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

## Mailbox retention (set at workspace creation)

- **Screen:** "How long should the server hold messages for members who are offline?"
  - **1 week:** least server exposure. Members must open the app weekly.
  - **2 weeks (recommended):** works for most shifts and vacations.
  - **1 month:** for members who rarely open the app. Leaves the most scrambled data on the server.
- Only Core can change it later (Members & keys screen). The change applies to new messages only.
- A member offline longer than the retention period sees "You missed some updates. Meet up with a committee member to resync," and syncs directly when they next connect to a peer.
- Server enforcement: `05-security.md` §Mailbox, `07-stack-and-hosting.md` P8.

## Error reports (opt-in)

- Errors are kept in a local buffer on the device. Settings shows **"Send an error report."** It previews exactly what will be sent and never includes names, ratings, notes, room IDs or keys.
- Off by default. There is no automatic sending (`07-stack-and-hosting.md` G6).

## Sync, invites, removal, storage (R3)

Specified in `05-security.md`:
- §Servers (matchmaker, relay, mailbox)
- §Invites
- §Removal
- §Device storage and iOS
- §Building blocks

## Hand-off export formats (screen 11, R3.9)

The export is the one moment workspace data leaves the encrypted system as readable text.
- It needs a second Core member's approval.
- It's generated on-device.
- It's never uploaded by us.
- The screen tells the user: "Send this file to your organizer directly (Signal), then delete it from this phone."

**Shared rules for both formats:**
- One row per coworker, UTF-8 CSV with a header row.
- No line breaks inside fields; replace them with spaces. Action Builder uploads break on them [A57].
- Dates as `YYYY-MM-DD`.
- A stable **Custom ID** per coworker: a random ID that is never derived from a name, so a second export updates records instead of duplicating them.
- Export only what the union needs to start. Notes are **off by default**, with a toggle and a warning: "Notes may name people or say who's leaning which way. Only include them if your organizer asked."

**Action Builder** (CSV only) [A57]:
- An admin uploads to a campaign in Standard Mode, then maps columns. Headers that match Action Builder field names map automatically.
- Use these header names:
  - `Custom ID`
  - `First Name`, `Last Name`
  - `Email`, `Phone Number`
  - `Preferred Language` (e.g. `en`, `es`)
  - `Assessment` (our 1–5)
  - `Note`, `Note Date`
  - Shift fields (`Shift Field Response` plus a day/time column per weekday)
- Department and other custom "info fields" only import if the campaign already has them, and the values must match the accepted responses exactly. Include a one-page "set these fields up first" note in the export.
- Action Builder provides a sample file (`Action-Builder-Upload-Example.csv`) on that help page. `TODO(verify)`: fetch it and match our headers to it exactly.

**Broadstripes** (XLSX, XLS or CSV; only the first tab is read) [A58][A59][A60]:
- Separate `First Name` / `Last Name` columns.
- Header names are auto-mapped. Matching ignores capitalization, extra spaces and hyphens.
- Custom fields (rating, issues, social groups) must be created in the project before import. Dropdown fields need "Allow imports to add options" turned on.
- Employment uses Broadstripes' built-in subfields: `Department`, `Classification`, `Work location`.
- Put our Custom ID in an **external system ID** column. Broadstripes matches on it automatically, so re-imports update instead of duplicating. Custom fields can't be used for matching.
- Conversation history can become timeline items, which need four columns: `Timeline Item Type`, `Timeline Item Date`, `Timeline Item Description`, `Timeline Contacted by Unique ID`.
- Ratings map to the project's **assessment codes**, which each union sets up. Ask the organizer which code matches our 1–5.
- `TODO(verify)`: the exact auto-mapping header list. The Broadstripes "Data import fields" table renders with JavaScript and came back empty here.

**Summary sheet** (both formats): counts by rating and department, the top issues, and the committee's contact person. No individual notes.

## Research gaps (blockers for R3.9 and R3.8)

- [x] Import formats for Action Builder and Broadstripes (above). Remaining: Action Builder's sample CSV, and Broadstripes' full header list.
- [ ] Watch real apps, not just marketing pages: AB 101 video, Action Builder Help Center, Broadstripes "How it works" + PASNAP case study.
- [ ] Run 5 usability sessions with non-organizers on paper prototypes of screens 1–4 before building. The agent prepares the prototypes and scripts; humans run the sessions.

---

> File: `05-security.md`

# 05 Security

**This file overrides every other plan.**

**Core rule:** a central list of who is organizing where is the most dangerous thing this site could hold. If it is breached, subpoenaed or leaked, workers get fired. So the server never holds readable worker data. This is CryptPad's model: if its code isn't modified, neither the admins nor an attacker who breaches the server can read user content [A6].

## Invariants (test each one)

| # | Invariant | How to test |
|---|---|---|
| S1 | No plaintext worker data leaves a device | Proxy all traffic; grep for seeded canary names in every request body, header and URL |
| S2 | No third-party requests | CSP `default-src 'self'`; CI crawls every page and fails on any off-origin request |
| S3 | No accounts, no email collection | Code review; no auth endpoints |
| S4 | Keys never reach a server | Secrets live only in URL fragments (`#…`), which are stripped from history on open; fragments are never logged |
| S5 | Servers keep no logs with IPs | Config review of the app, web server and host; logs off or IP-scrubbed |
| S6 | Tools never send user input | Tests mock `fetch` and assert zero calls carry input |
| S7 | Code updates are signed and user-approved | Tampered build fails signature check; app refuses it |
| S8 | Workspace edits are deniable | No workspace update carries a per-device signature. A leaked export can't be verified as written by a specific member (see §Deniable edits) |

## Build vs. integrate

| Need | Decision | Why |
|---|---|---|
| Chat | **Integrate Signal.** Write guides and group templates (usernames instead of phone numbers, disappearing messages, separate "Committee" and "Trusted contacts" groups). | Signal usernames avoid sharing phone numbers [A7]. Signal keeps no record of group membership, names or avatars. Groups support link/QR invites, admin approval, admin-only timer control, and up to 1,000 members [A17]. Building messaging is a multi-year security project. |
| Chat for 200+ person units | Matrix/Element, later | Needs 24/7 servers and accounts |
| Docs and files | Self-hosted CryptPad on `pad.` subdomain; Proton Drive as fallback | Open source, end-to-end encrypted, already built |
| Wall chart | R2: CryptPad templates. R3: local-first app. | Ship without writing crypto first |
| Authorization cards | **Don't collect them.** Give printable explainers; signing goes through the union. | E-signatures require name, contact info, phone, authorization language, date, employer, a declaration describing the technology, and a confirmation to each signer [A8]. Holding them puts identities on the server. |
| Dues | **Don't build.** | Compliance and liability |
| Crypto | WebCrypto or libsodium only | No homemade primitives |

## Threats and defenses

| Threat | Defense |
|---|---|
| A coworker reports to the boss (most common) | Technology can't fix this. Need-to-know rooms; Organize content teaches vetting through one-on-ones before sharing names. |
| Employer monitoring of work devices, email, chat, Wi-Fi | Work-device banner; "never use company Slack or email"; mobile-first |
| Lost or seized phone | App lock with a separate passcode, auto-lock, a wipe button that also clears unsent updates, disappearing messages in Signal, one-time mailbox keys (old updates unreadable) |
| Subpoena to the site | Server holds only scrambled data; short log retention, no IPs; counsel on standby; published legal-request policy |
| Site breach | No readable data; no third-party scripts/CDNs/analytics; strict CSP; independent audit before workspace launch |
| Lost workspace key | 2-of-3 recovery split among core members; site can't recover it, and says so |
| Fake "union" or poisoned directory | Directory from verified sources only; editor review; changelog |
| Tampered app code | See §Code delivery (biggest risk) |

Build security content on EFF Surveillance Self-Defense, especially its security-plan exercise.

## Web hardening (content site and app)

- Headers: `Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`, HSTS with preload, `Referrer-Policy: no-referrer`, `Permissions-Policy` denying camera/mic/geolocation (except the app's photo capture), `X-Content-Type-Options: nosniff`.
- Subresource Integrity on every script and style.
- No CDN anywhere (decided 2026-10-26). Everything is self-hosted on the owner's Coolify box. Proxy access logs off or IP-stripped (`07-stack-and-hosting.md` H3).
- CSP must allow the first-party Umami path (`/s/`) and the GlitchTip tunnel (`/e/`) as `'self'` only. No other origins.
- **Error reporting and analytics** are the main ways private data could leak into logs. Follow `07-stack-and-hosting.md` §GlitchTip (G1–G7) and §Umami (U1–U6) exactly. Add a CI test that fails if a Umami or GlitchTip request fires on any tool page, `/toolkit/*` or `app.`, or if any outgoing report contains a seeded canary string.
- **Matchmaker state never goes in PocketBase** or any other disk-backed store.
- The corrections form posts to a queue with no IP logging and no email field required.

## Workspace architecture (R3)

**Model:** the workspace lives only on members' devices and syncs directly between them. A shared-editing library (Yjs; Automerge as an alternative) merges offline edits without conflicts [A20].

### Servers

| Server | Job | Can see | Can never see |
|---|---|---|---|
| Matchmaker | Helps devices in the same workspace find each other | A daily-rotating room ID, IPs, connection times | Names, ratings, notes, anything in the workspace |
| Relay (**on by default**) | Passes traffic so members never see each other's IPs | Scrambled traffic, size, timing | Contents, which member is which |
| Encrypted mailbox | Holds updates for offline members (night shift gets day shift's notes) | Scrambled updates padded to fixed sizes, a daily-rotating queue label, arrival times | Contents, member identities, who an update is for, how many members a room has |

**Public copy must say:** "No server holds your data. Our servers pass along scrambled messages they can't read. They can see that a device connected, and when." **Never say "no servers."**

### Matchmaker hardening

| Goal | How |
|---|---|
| Can't read or hijack | All signaling encrypted with the room key (y-webrtc does this when a room password is set [A22]). Devices authenticate with invite-derived keys, so a hacked matchmaker can't insert a fake member. Worst case: block or delay connections. |
| Holds nothing | Memory only; no disk; IP logging off in app, web server and host; no CDN; no accounts; no lasting connection IDs |
| Silent to strangers | Per-workspace secret network key. A device without it can't finish the handshake, and the server never confirms what it is (like SSB's secret handshake [A24]). |
| Can't follow a room over time | `roomId = HMAC(roomKey, UTC date)`, rotating daily; only members can compute it |
| Harder to correlate joins | Random join delays; padded signaling messages |
| Never sees real IPs (high-risk mode) | Optional Tor onion services for matchmaker, relay and mailbox |
| Survives takedown | 2–3 matchmakers on different hosts with failover; committees can self-host; last resort: in-person QR pairing with no matchmaker |
| Survives abuse | HTTPS only, per-room rate limits, proof-of-work to join, separate host from the content site, open source, auto-patching |

**Legal demands:** with no logs, a subpoena for past records gets nothing. But a court can order you to start logging. Tor mode and the relay exist for that case. Keep a lawyer, and publish a legal-request policy. Don't rely on a warrant canary; its legal standing is disputed.

### Mailbox

- Retention: chosen per workspace from three fixed options: **1 week, 2 weeks (default) or 1 month.** The client sets `expires_at`. The server rejects anything over 31 days and purges hourly. Implementation on PocketBase `mbx`: `07-stack-and-hosting.md` P6–P11.
- Queue labels are `HMAC(roomKey, "mbox", date)`, rotating daily.
- Messages are padded to fixed size buckets.
- No recipient list or member count is visible to the server.
- **Forward secrecy:** each recipient device publishes one-time prekeys (Signal-style) into the encrypted room state. Mailbox messages are encrypted to one-time keys that are deleted after use, so a later device seizure can't open old queued messages.
- Never use public Nostr relays. Their recipient tag exposes who a message is for.

### Invites

Never one reusable link. Every invite is single-use and bound to one device.
1. A core member taps Invite and gets a one-time link that expires in 24h. The secret sits after the `#`, which browsers never send to servers (the CryptPad pattern [A18]).
2. Share over Signal only. The share sheet offers nothing else.
3. The new member opens it on their own phone. The app immediately calls `history.replaceState` to remove the fragment, because browser history can sync to an employer's Chrome profile. Then it generates a device key.
4. The inviter sees a join request with a **4-word check code**, which both people compare in person or on a Signal call. The inviter approves.
5. The inviter's device sends the room keys, encrypted to the new device key. The invite is now dead.

### Removal

- Removal cuts off future updates. **It can't take back what the person already synced.** Say this plainly in the app and in the content.
- It needs approval from 2 core members.
- The remaining devices generate new keys and move to a new room ID. The old room is abandoned and its mailbox queue deleted.
- The room split limits exposure to the removed person's tier.

### Device storage and iOS

- Safari deletes script-writable storage after 7 days of Safari use without visiting the site. Home Screen web apps keep their own separate counter [A21].
- **On iPhone, setup blocks until the app is added to the Home Screen.**
- Call `navigator.storage.persist()`.
- The Today screen warns when fewer than 2 devices hold a full Core copy.
- A monthly prompt saves an encrypted backup file to the member's own storage.
- **Later (after R3): optional remoteStorage backup destination** [A30][A31].
  - remoteStorage is an open protocol for personal storage that apps reach through OAuth, and remotestorage.js can also target Dropbox or Google Drive.
  - Upload only the encrypted backup file, under a neutral filename. Show a "never use a work account" warning.
  - Tell the user that the provider still sees that the file exists, its size and when it changes.
  - Strip the OAuth token from the URL fragment immediately (same pattern as invites).
- Lost key → 2-of-3 recovery.

### Building blocks and limits

- **Sync:** Yjs + y-indexeddb; y-webrtc for direct sync with an encrypted signaling password [A22].
- **Size limit:** y-webrtc is a full mesh and its docs say it isn't suited to many collaborators. That's fine for 5–20 people. Larger committees sync via relay + mailbox.
- **Evaluate existing open-source encrypted Yjs sync servers before writing a custom layer.**
- **Crypto:** WebCrypto / libsodium. Data at rest uses AES-GCM with a key derived from the passphrase.

### Deniable edits

**Don't sign workspace edits with per-device keys.** A signed edit lets a member who flips hand the boss a file that *proves* Maria wrote "Dev is a 5."

- **Device authentication happens at connect time,** with the invite-derived keys: who is allowed in.
- **Edit integrity uses a MAC with the shared room key**, e.g. AES-GCM or HMAC over each Yjs update. Any member could have produced it, so a leaked copy proves nothing about authorship.
- **Author attribution inside the app** (the "by" field on conversations) is ordinary data. It is useful to members and not cryptographic proof.
- **Precedent:** atproto spaces drop signatures for the same reason. Permissioned data "should not carry proof of authorship that survives a leak outside its access boundary" [A32].
- **Exception: the retaliation evidence log keeps signatures and a hash chain.** There, the worker *wants* proof that entries weren't backdated or edited.

## Code delivery (biggest risk)

Whoever serves the app's code can break all the encryption. A tampered build could copy every member's keys. If the content site is hacked or legally compelled, this is the attack.

- The installed Home Screen app keeps a known-good copy and **updates only when a member taps Update**, showing the version and release notes.
- App code is served from its own subdomain, separate from the content site, with strict CSP and SRI on every file.
- Every release is signed by the maintainers, and its fingerprint is published in an append-only transparency log. The app verifies the signature before installing.
- **Reproducible builds:** anyone can rebuild from public source and match the release byte for byte.
- Longer term: app-store wrappers (iOS/Android) for signed updates.

## Lessons from other protocols (don't adopt any)

Both hide content but leak who talks to whom. A union-buster already knows the workforce and only needs that.

| | bitchat [A25] | Scuttlebutt [A24] |
|---|---|---|
| Identity on the network | Short ID from a never-rotating key, broadcast over the air with your nickname | Permanent key pair; LAN broadcasts the public key every second |
| Connections | Announcements list up to 10 nearby devices, unencrypted | Follows are public, so anyone can draw the social graph |
| Private messages | No forward secrecy for courier/Nostr messages; the Nostr tag names the recipient | Sender, time and size are public; max 7 recipients; private-groups spec says "not fit for use in safety critical situations," unaudited, no forward secrecy [A26] |
| Delete | Local panic wipe | Impossible (append-only) |
| Runs in a browser | No | No |
| Health | Active, has a whitepaper | Mostly dormant [A27]; successor PZP "not ready for end users" [A28] |

**Borrowed (already in the specs above):**
- daily-rotating labels for room IDs and mailbox queues;
- a per-workspace network key with a silent handshake;
- hidden recipient lists;
- Restricted invite mode for Core;
- signed, hash-chained evidence entries;
- a wipe that clears queued data;
- a published whitepaper with an honest security section.

**Do better than both:**
- real deletion via re-keying;
- membership never posted anywhere;
- one-time mailbox keys;
- relay on by default;
- no public Nostr relays.

**Later, maybe (not R1–R3):** a native Bluetooth mode for no-signal workplaces and pickets. It would need rotating on-air IDs and a warning that nearby phones remain detectable. tinySSB shows the idea works over LoRa [A29].

### Storage protocols checked (don't use for workspace data)

In all three, the storage server can read data unless the app encrypts it, and each person carries a lasting identity that links them to the drive.

| Protocol | Finding | Borrowed |
|---|---|---|
| **Atproto spaces** (PDSes) | "Access control, not confidentiality"; not end-to-end encrypted. Each member's PDS stores their records under an address naming the space, and the space host issues access per user DID, so servers can infer membership. Alpha: "has not undergone careful security review. Do not upload sensitive information." [A32][A33] | Deniable edits (§Deniable edits); short-lived access credentials (10 min default) |
| **Solid pods** | No built-in encryption; the pod provider can read data. Access lists live on the server; WebIDs are lasting URLs [A34] | Nothing |
| **remoteStorage** | Per-user storage via OAuth scopes; no shared-space model; server sees what it's sent [A30] | Optional encrypted backup destination (§Device storage and iOS) |

**Revisit atproto only if** spaces ship audited end-to-end encryption that also hides which PDSes hold a space's data. Even then, every member would need an atproto account linked to the drive.

## Audit scope (R3 gate)

The independent audit must cover:
- invites;
- removal and re-keying;
- fragment stripping;
- mailbox metadata and the one-time-key scheme;
- backup files;
- the 2-of-3 recovery;
- matchmaker, relay and mailbox servers;
- code delivery (signing, transparency log, reproducible build);
- the evidence-log hash chain;
- deniable edits (no per-device signatures on workspace updates).

---

> File: `06-open-decisions.md`

# 06 Open decisions

**Agents: don't decide these.** If a task depends on one of these, stop, note what you need, and ask the owner.

## Reserved for the owner

| # | Decision | Why it matters | Blocks |
|---|---|---|---|
| 1 | **Handoff partner and timing.** The owner operates for now; the goal is adoption by EWOC or a union. | The new operator takes legal demands and the privacy promises (`07-stack-and-hosting.md` O4) | Handoff |
| 2 | **A second person with server access.** One operator on one box is a single point of failure for patching and incidents. | The bus factor for the mailbox, matchmaker and CryptPad | R2 launch, R3.6 |
| 3 | **Pilot partners.** EWOC is the natural fit; it already coaches thousands of self-organizing workers. | R3 shouldn't launch without real committees testing it | R3.G2 |
| 4 | **Labor lawyer for review** of every `[!]` page | Required gate for R1 | R1.G |
| 5 | **Default mailbox retention.** Choices are fixed at 1 week, 2 weeks or 1 month. Suggested default: 2 weeks. | Members who open the app less often than the retention period miss updates and need a resync | R3.6 |
| 6 | **Umami and GlitchTip privacy copy and the IP choice.** Approve the honest privacy text (`07-stack-and-hosting.md` U6, G7) that replaces "we keep nothing." Decide whether the analytics proxy strips IPs (U0c, recommended: no location data, rougher visitor counts). | It's a public promise the operator must keep | R1.10, R0.8 |
| 7 | **Employer research data path** (T10): bundled indexes vs. opening official sites in a new tab (with the leaving-the-site warning) | Privacy vs. freshness | R1.24 |
| 8 | **Spanish reviewer:** who reviews agent drafts of `[!]` pages (a translator, an EWOC volunteer, or a union's Spanish-language staff) | Quality of legal terms | R1.11 |
| 9 | **The 8 stage names** on `/start/stages` (proposed in `01-content.md`) | Site-wide framing | R1.1 |
| 10 | **Security auditor** selection and budget | Required gate for R3 | R3.G1 |

**Already decided:**
- Voice: blunt and plain-spoken.
- Scope: private sector + nonprofits, no government.
- "Not legal advice" framing on legal pages.
- A structured union and local dataset.
- No accounts: one-time device-bound invites.
- Signal for chat; CryptPad for docs.
- Don't collect cards or dues.
- Don't build on bitchat, Scuttlebutt, atproto spaces, Solid or remoteStorage for workspace data.
- Decided 2026-10-26:
  - The owner operates for now on their own Coolify box, aiming for handoff to EWOC or a union.
  - Self-hosted, no CDN.
  - Astro static site.
  - PocketBase for content/config (`cms`) and the encrypted mailbox (`mbx`).
  - GlitchTip for errors.
  - Umami for analytics.
  - Leaving-the-site warning.
  - Spanish at launch.
  - Mailbox retention of 1 week / 2 weeks / 1 month, chosen by each committee.
- Agent note (not an owner decision): sessions/signaling stay out of PocketBase and in memory; PocketHost.io isn't used for anything sensitive. Reasons in `07-stack-and-hosting.md`. Owner can overrule.

## Research gaps

Filled 2026-10-26 (now in `01-content.md` §Legal status):
- [x] RLA: the NMB requires a 50% showing of interest [A42], and elections are decided by a majority of valid ballots cast [A43].
- [x] State captive-audience bans: 12 states (AK, CA, CT, HI, IL, ME, MN, NJ, NY, OR, VT, WA). Several are in court and some are on hold [A44][A45].
- [x] GC 25-05 rescinded GC 22-04 (captive audience) and other memos. Board reversals of Cemex, Stericycle, McLaren Macomb and others are expected [A45][A46].
- [x] Union intake links: 23 of 26 rows verified or partly verified (`data/unions.csv`). Added NUHW, UE, IATSE, Equity, WGA East, AFSCME CWU and the NABTU route on 2026-10-26.
- [x] GC 25-05 (Feb 14, 2025, Acting GC Cowen) [A46]. A law-firm summary of what it rescinded lists GC 21-08, 24-06, 23-05, 23-08, 25-01, 21-06, 22-06, 24-04 and 24-01 (the Cemex guidance) [A48]. GC 15-08 (2015) isn't on that list, and the memo targeted the previous GC's memos. Likely still in force; final check against the memo text is below.
- [x] 2023 election rule (88 FR 58076, effective Dec 26, 2023) [A49]. The Federal Register's list of significant NLRB documents shows no rescission as of 2026-10-26; the latest is the Feb 27, 2026 joint-employer withdrawal. Treat the faster election timeline as current, and recheck monthly.
- [x] Astro loader: `astro-loader-pocketbase` exists and is maintained, with versions for Astro 5–7 [A50].

Still open:
- [ ] Union intake links still open:
  - **SAG-AFTRA:** the site returns 403 to our fetcher.
  - **SEIU building services:** 32BJ has no organizing intake page, so we may need to route to locals.
  - **SEIU national** intake URL.
  - **NABTU:** no trades-wide intake. Route by craft local, with the AFL-CIO organizer contact as fallback (confirm that page).
  - **AFSCME CWU:** the Form a Union page URL.
  - Added 2026-10-26: Equity, WGA East and the CWU site.
- [ ] GC 15-08: confirm against the GC 25-05 PDF itself. The PDF didn't render here.
- [ ] NLRB jurisdiction thresholds: believed to be $500k gross for retail and $50k inflow/outflow for nonretail. The nlrb.gov page didn't render; confirm there.
- [ ] Median days from petition to election under the 2023 rule (NLRB election statistics).
- [x] Action Builder and Broadstripes import formats: now in `04-workspace-app.md` §Hand-off export formats. Remaining: Action Builder's sample CSV, the Broadstripes header list, and a live demo with a friendly organizer.
- [x] Umami: data collected, defaults and settings, now in `07-stack-and-hosting.md` §Umami. Remaining: the Postgres table names for the purge job.
- [ ] Labor Notes URLs for the cited books and guides.
- [ ] Usability sessions on paper prototypes (screens 1–4).
- [ ] Content: answers to the boss's top 15 arguments; phase 6 bargaining content; remote organizing.

## Agent assumptions

When a plan was silent and you made a call, log it here in this format: date · task · assumption · why · reversible?

---

> File: `07-stack-and-hosting.md`

# 07 Stack and hosting

The owner's choices as of 2026-10-26, and the rules for each one. Where this file and `05-security.md` disagree, `05-security.md` wins.

## Summary

### Owner requirements (2026-10-26) and where each lives

| Owner said | Where it's specified | Notes |
|---|---|---|
| Host on my own Coolify Linux box; later adoption by EWOC or a union | §Coolify H1–H7, §Handoff O1–O4 | Everything as code so a new org can rebuild it |
| Let the user select 1 week, 2 weeks or 1 month | `04-workspace-app.md` §Mailbox retention, P8 | Interpreted as how long the encrypted mailbox holds messages for offline members. If you meant something else, tell the agent; nothing else depends on it. |
| Capture logs to our own GlitchTip | §GlitchTip G1–G7 | Scrubbed, IP-stripped, 14 days. Workspace sends only on a member's tap. |
| Popup before leaving to a third-party site | §Leaving-the-site warning L1–L6 | |
| Yes to Spanish | `00-roadmap.md` R0.2, R1.11 | Reviewer still open (`06` #8) |
| Fill research gaps, update docs | `06-open-decisions.md` §Research gaps | |
| Build with Astro | §Astro A1–A8 | |
| PocketBase/PocketHost for content, configs, p2p sessions | §PocketBase P1–P11 | Content and config: yes (`cms`). Encrypted mailbox: yes (`mbx`). Live p2p signaling: kept in memory, not PocketBase, so nothing records who connected with whom. Self-hosted on Coolify, not PocketHost.io. **Owner can overrule both.** |
| PocketBase migrated off GitHub | §PocketBase status | Source: `ganigeorgiev.com/pocketbase/pocketbase` |
| Umami self-hosted for analytics | §Umami U1–U6 | Content pages only |

### Components

| Layer | Choice | Where it runs |
|---|---|---|
| Site | **Astro**, static output | Coolify, owner's Linux box |
| Content + config store | **PocketBase** (instance A: "cms"), never public | Coolify, private network only |
| Workspace encrypted mailbox | **PocketBase** (instance B: "mailbox"), public API, hardened | Coolify, its own subdomain |
| Matchmaker (signaling) | Small in-memory service. **Not PocketBase.** | Coolify, its own subdomain |
| Relay | TURN server (e.g. coturn) | Coolify or a second box |
| Error tracking | **GlitchTip**, self-hosted | Coolify, private subdomain |
| Analytics | **Umami**, self-hosted, content pages only | Coolify, first-party path |
| Docs/files for committees (R2) | CryptPad, self-hosted | Coolify |

**Long-term goal: adoption by EWOC or a union.** Build everything so it can be handed over in a day. See §Handoff.

## Coolify (owner's box)

Coolify's one-click catalog includes PocketBase, GlitchTip and Umami [A35]. Use them, but pin image versions.

- [ ] **H1 Lock down the Coolify dashboard.**
  - Reachable only over a VPN or tailnet, never the open internet.
  - 2FA on.
  - No shared logins.
- [ ] **H2 Separate subdomains per service.** Choose neutral names, not "union" (see `05-security.md` §Network visibility):
  - `www` / apex: Astro site
  - `app`: workspace code, served separately from the content site
  - `mbx`: PocketBase mailbox
  - `sig`: matchmaker
  - `turn`: relay
  - `errors`: GlitchTip (private)
  - `cms`: PocketBase content (private)
  - `pad`: CryptPad
  - Umami is served under a first-party path on the main site (e.g. `/s/`), proxied to the Umami container.
- [ ] **H3 Turn off reverse-proxy access logs** for `www`, `app`, `mbx`, `sig`, `turn` and `/s/`, or strip IPs before writing. Coolify's proxy (Traefik or Caddy) logs by default; check the generated config.
  - Accept: send test requests, then grep the box for your own IP. There should be zero hits outside the SSH auth log.
- [ ] **H4 Security headers** on the static site (CSP, HSTS, Referrer-Policy `no-referrer`, Permissions-Policy, nosniff), set in the proxy or the static server config. Spec: `05-security.md` §Web hardening.
- [ ] **H5 Backups.** Encrypted, offsite, tested monthly.
  - Back up only: PocketBase `cms`, Coolify config and CryptPad.
  - **Don't back up the mailbox.** It holds only short-lived scrambled data. Losing it costs a resync; backing it up extends its retention.
- [ ] **H6 OS hardening.** Unattended security updates, SSH keys only, firewall open only on 80/443 plus the TURN ports, full-disk encryption if the host supports it.
- [ ] **H7 Everything as code.** Docker Compose files, Coolify exports and env templates go in the repo (secrets excluded), so a new operator can rebuild from scratch.

## Astro

- [ ] **A1 Project setup.**
  - `output: 'static'`.
  - i18n with `locales: ['en','es']`, `defaultLocale: 'en'` and `prefixDefaultLocale: false`, so Spanish lives at `/es/...` and matches the sitemap [A36].
  - Pin the Astro version in `package.json`.
- [ ] **A2 Disable telemetry** in dev and CI (`ASTRO_TELEMETRY_DISABLED=1` or `astro telemetry disable`). `TODO(verify)`: confirm the current flag name in the Astro docs.
- [ ] **A3 No remote anything at runtime.**
  - No remote font providers; self-host fonts.
  - No remote image domains.
  - No third-party integrations that inject scripts.
  - Prefetch off.
- [ ] **A4 Content from PocketBase at build time only.**
  - Use `astro-loader-pocketbase` [A50]. It fetches entries only at build time.
  - Pin the loader major version to your Astro major (per its compatibility table: loader 4.x for Astro 7, 3.x for Astro 6).
  - Use its `localSchema` option with an exported `pb_schema.json` so CI doesn't need superuser credentials. If remote schema is needed, use a revocable impersonate token, never a password.
  - Use `filter: "status = 'published'"` and `updatedField` for incremental builds.
  - **Don't use its live loader.** That would make the public site call PocketBase at runtime.
  - The live site never calls PocketBase. Every page is static HTML.
- [ ] **A5 Tools as islands.** The router, matcher, decoder, calculators and evidence log are client-side islands (vanilla JS or Preact) with all data bundled. No server endpoints (`03-private-tools.md`).
- [ ] **A6 Build validation.** Zod schemas on every collection, mirroring `02-data-model.md`. The build fails on invalid or unverified records reaching live links.
- [ ] **A7 Rebuild trigger.** A PocketBase hook (or a scheduled job) calls a Coolify deploy webhook when content is published. Editors see changes after a rebuild, not instantly.
- [ ] **A8 Workspace app is a separate build** (`app.` subdomain), with its own CSP and the signed-release pipeline in `05-security.md` §Code delivery. Don't ship it inside the content site.

## PocketBase

**Status:** the maintainer moved the project off GitHub on 2026-10-26. The GitHub repo is archived and points to `ganigeorgiev.com/pocketbase/pocketbase` [A37]. It's still pre-1.0, and "full backward compatibility is not guaranteed before reaching v1.0.0" [A37].

**Rules that follow from that:**
- Pin the exact version.
- Read release notes before every upgrade, and test upgrades on a copy first.
- Update the download source in the Compose files to the new home.

**Use self-hosted PocketBase on Coolify, not PocketHost.io**, for anything beyond throwaway experiments:
- pockethost.io is a third-party host.
- It "does not back up your instance data."
- Its data volume "is not encrypted at the OS level" [A38].

The open-source PocketHost software is fine to study, but there's no need for it on a single box.

### Instance A: `cms` (private)

Holds content, union and local records, legal rules, sources, site configuration, and translation strings.

- [ ] **P1 Not on the public internet.** Reachable only from the build job and from editors over the VPN or tailnet.
- [ ] **P2 Editors** get named accounts with MFA. Roles:
  - **editor:** draft;
  - **reviewer:** publish;
  - **legal:** can set `review: approved` on `[!]` pages. Only the owner grants this.
- [ ] **P3 Collections** mirror `02-data-model.md`. Add `status` (draft, review, published) and `last_checked` to each, and keep a version history.
- [ ] **P4 Git export.** A nightly job exports published records to `data/*.json` in the repo, so changes are reviewable, diffable and survive a PocketBase failure. The repo export is the source of truth for the handoff.
- [ ] **P5 Site config** (feature flags, banner text, mailbox retention options, Umami on/off) lives in a `config` collection that is read at build time.

### Instance B: `mbx` (public, encrypted mailbox)

PocketBase is a reasonable fit for the mailbox. It only ever holds scrambled blobs, and its realtime subscriptions let online devices get updates without polling.

- [ ] **P6 Turn PocketBase's own logs off.** PocketBase records every request, including IPs, in its log store by default. Set *Logs → Logs settings → Max days retention* to `0`, which "will disable the logs entirely" [A39]. Verify after every upgrade.
- [ ] **P7 One collection, `queue`**, with fields: `label` (daily-rotating HMAC), `blob` (padded ciphertext), `expires_at`.
  - No user accounts, no relations, nothing that names a person or a room.
  - Writes are authorized by a proof the client derives from the room key (an HMAC over label and timestamp), checked in a hook.
- [ ] **P8 Retention set by the committee: 1 week, 2 weeks or 1 month.** Default 2 weeks.
  - The client sends `expires_at` with each write. The server refuses anything over 31 days.
  - A PocketBase cron job deletes expired rows hourly and runs `VACUUM` so deleted data doesn't linger on disk.
  - Spec for the choice screen: `04-workspace-app.md` §Mailbox retention.
- [ ] **P9 Rate limits and size caps** per label (proxy and hook), to stop abuse and storage flooding.
- [ ] **P10 No admin UI on the public subdomain.** Expose only the `queue` API; block `/_/` at the proxy.
- [ ] **P11 No backups** (see H5).

### Not in PocketBase: the matchmaker ("p2p sessions")

Don't store signaling sessions or "who's online" in PocketBase. It writes to disk, which would create exactly the record of who connected together, and when, that `05-security.md` §Matchmaker forbids.

The matchmaker is a small memory-only service (y-webrtc's signaling server, or an equivalent) with logging off. If a durable list of active rooms ever seems necessary, that's a design smell. Ask the owner first.

## GlitchTip (error tracking)

Self-hosted, Sentry-SDK compatible [A40].

**The risk:** error reports are a classic way private data leaks into logs (URLs, form values, stack variables) along with the sender's IP. The rules below keep GlitchTip useful for fixing bugs without becoming a record of who uses the site.

- [ ] **G1 Retention.** Set `GLITCHTIP_RETENTION_DAYS=14` (the default is 90) [A40].
  - Disable features we don't use: uptime monitoring (`GLITCHTIP_ENABLE_UPTIME=False`), and log ingestion (`GLITCHTIP_ENABLE_LOGS=False`) unless server logs are routed there under G5.
  - Turn self-registration off after creating the owner account (`ENABLE_USER_REGISTRATION=False`).
  - Restrict `ALLOWED_HOSTS`.
- [ ] **G2 Private dashboard.** `errors.` is reachable only over the VPN. Browsers never talk to GlitchTip directly.
- [ ] **G3 First-party tunnel.** Browser SDKs send to a same-origin endpoint (`/e/`), using the Sentry SDK `tunnel` option.
  - The endpoint strips the client IP, `User-Agent` detail, cookies and referrer before forwarding to GlitchTip.
  - CSP `connect-src` allows only `'self'`.
- [ ] **G4 SDK settings (content site and tools).**
  - `sendDefaultPii: false`; no user context; no session replay; no performance tracing.
  - Breadcrumbs off (console, DOM clicks, fetch, navigation).
  - `beforeSend` strips query strings and URL fragments from every URL, drops `extra` and `contexts` except browser and OS family, and caps message length.
  - Sample errors at a fixed rate.
- [ ] **G5 Server errors** (PocketBase hooks, matchmaker, build): report the exception type and stack only. Never request bodies, headers, labels, blobs or IPs.
- [ ] **G6 Workspace app: off by default.**
  - Errors go into a local ring buffer on the device.
  - A member can choose **"Send this error report"**, which first shows them exactly what will be sent. Reports never include workspace data, names, ratings, notes, room IDs or keys.
  - Accept: a test suite seeds canary names into the workspace and fails if any canary appears in an outgoing report.
- [ ] **G7 Privacy page** says plainly: "When something breaks, we get an error report without your IP address. We keep it for 14 days."

## Umami (analytics)

Self-hosted, cookieless. It's useful for knowing which pages help and whether Spanish pages get used. But it is still tracking. It assigns each visitor a pseudonymous ID [A41], and it records page paths and browser/device details. `TODO(verify)`: the exact fields in the current version (umami.is didn't load). The rules keep it to aggregate page counts.

**What Umami v3 does by default (checked against its docs, 2026-10-26):**
- It collects pageviews, referrers, browser, OS, device type and approximate location (from IP, via a GeoIP database) [A53].
- It counts a visitor by hashing website ID, hostname, IP and User-Agent with a salt that rotates monthly by default (`SALT_ROTATION`: `month`, `week` or `day`) [A54].
- The tracker turns on pageviews, click tracking and path-change detection by default [A55].
- v3 also has session **replays** (a separate `recorder.js`, sampling 15% of sessions, kept 30 days) and heatmaps [A56].
- **Self-hosted data is kept forever unless you delete it** [A53].

- [ ] **U0 Pin Umami v3.x** and set:
  - `DISABLE_TELEMETRY=1`, `DISABLE_UPDATES=1`
  - `PRIVATE_MODE=1` (no outside network calls)
  - `MCP_ENABLED` unset, `ENABLE_TEST_CONSOLE` unset
  - `SALT_ROTATION=day`
  - `TRACKER_SCRIPT_NAME` and `COLLECT_API_ENDPOINT` set to neutral first-party paths under `/s/`
  
  These variables are documented [A54].
- [ ] **U0b Never enable replays, heatmaps, performance (`data-performance`), distinct IDs (`data-distinct-id`, `identify()`), revenue or pixels.** Never load `recorder.js`.
  - Accept: CI fails if `recorder.js`, `data-distinct-id` or `umami.identify` appears in the build output.
- [ ] **U0c Strip the IP before Umami sees it (recommended).** The `/s/` proxy replaces the client IP with a fixed value.
  - Trade-off: no location data, and the "unique visitors" count becomes a rough estimate. Pageview counts per page and language stay accurate, and those are what we need.
  - Owner can opt out (`06-open-decisions.md` #6). If they do, keep `SALT_ROTATION=day` and turn off city/region in reports.
- [ ] **U1 Content pages only.** No Umami script on:
  - `/toolkit/*`
  - any page with a tool island (router result, decoder, evidence log, calculators)
  - the workspace app (`app.`)
  - the leaving-the-site warning
  
  Tools never send events.
- [ ] **U2 First-party path.** Serve the script and the collection endpoint under the main domain (`/s/`), proxied to the Umami container, so there's no extra domain for networks to spot. Proxy logs off (H3).
- [ ] **U3 Minimum data.** Script tag attributes [A55]:
  - `data-exclude-search="true"`
  - `data-exclude-hash="true"`
  - `data-do-not-track="true"` (DNT is deprecated, so also check GPC in our own `data-before-send` handler)
  - `data-domains` set to our domain only
  - `data-before-send` pointing to a first-party function that cancels the send when:
    - the "Turn off counting" flag is set;
    - GPC is on;
    - the page is a tool page;
    - the payload type isn't a pageview. This blocks click and other auto-tracked events.
  - No custom events and no event data.
  - Footer link: "Turn off counting on this device" (a localStorage flag).
- [ ] **U4 Retention.** Self-hosted Umami keeps data forever by default [A53]. Run a nightly job that deletes raw rows older than 30 days from the Umami Postgres tables, and keep only monthly per-page totals. `TODO(verify)`: table names for the pinned version.
- [ ] **U5 Never share Umami data** outside the operating team. Not with partner unions, and not in public dashboards. Aggregate counts only in public reports.
- [ ] **U6 Honest copy.** The privacy page and footer drop "We keep nothing." New text:
  - "We count page visits without cookies to see which pages help."
  - "We don't save your IP address." **Only true with U0c on.** With U0c off, say: "Your IP address is used for a rough location and then thrown away."
  - "The tools and the workspace are never counted."
  - "Turn off counting →"
  
  Confirm each claim against the deployed configuration before publishing.

## Leaving-the-site warning

Every link to another domain, including union intake forms, the NLRB and EWOC, opens a warning first.

- [ ] **L1 Behavior.** One click handler on the document intercepts links whose host isn't ours, and opens a modal.
  - **Title:** "You're leaving Organize Your Workplace."
  - **Body:** "[destination domain] isn't run by us. It may keep records of your visit. On a work phone, work computer or work Wi-Fi? Go back."
  - **Buttons:** **Go back** (default focus) and **Continue to [domain]**.
  - Spanish version from the string catalog.
- [ ] **L2 Continue** opens the link with `rel="noopener noreferrer"` and `referrerpolicy="no-referrer"`, so the destination can't see which of our pages sent the worker.
- [ ] **L3 No server round-trip.** Don't build a `/leave?to=` redirect page. It would log destinations on our server. Without JavaScript, links still work and the noscript footer carries a one-line warning.
- [ ] **L4 Accessibility.** Proper dialog role, focus trap, Esc closes it (Go back). Quick Exit still works while the modal is open.
- [ ] **L5 Union intake links** add one line: "Organizers will contact you. Use a personal phone number and email."
- [ ] **L6 No Umami** on the modal, and no counting of outbound clicks.

## Handoff (to EWOC, a union or a nonprofit)

- [ ] **O1 Runbook** in the repo: services, ports, subdomains, env vars, backups, restore drill, upgrade steps (especially PocketBase pre-1.0), and incident contacts.
- [ ] **O2 Transfer checklist:**
  - domain registrar transfer, DNS, TLS;
  - Coolify rebuild on the new org's server from H7;
  - restore `cms` from backup or the git export (P4);
  - rotate every secret;
  - new GlitchTip and Umami owner accounts, with the old ones deleted;
  - publish a changelog note.
- [ ] **O3 Workspace continuity.** Committees' data lives on their phones, so moving servers doesn't move their data.
  - The new operator stands up `mbx`, `sig` and `turn`, and the app's next signed release points to them.
  - Run the old and new servers in parallel for one retention period (up to 1 month).
- [ ] **O4 Legal handover.** The new operator takes over the legal-request policy and the privacy promises. Until then, the owner personally is the operator and receives any legal demands (see `06-open-decisions.md` #1).

---

> File: `sources.md`

# Sources

Cite by ID in front matter (`sources: [P1-6, A16]`) and in plan text (`[A16]`).
- **P1-** IDs come from the Phase 1 research (legal ground, union map, first conversations).
- **A** IDs come from the architecture and toolkit research.

Some links are `google.com/goto` redirects captured during research. **Agent task:** resolve each one to its canonical URL, confirm it still loads, and replace it before publishing. Add new sources with the next free ID. Never renumber.

## Source tiers

| Tier | Sources | Use for |
|---|---|---|
| 1 Primary | NLRB decisions and GC memos, BLS, OLMS, appeals court opinions | Legal claims, statistics, local data |
| 2 Labor research | EPI, UC Berkeley Labor Center, Cornell ILR | The case for unions |
| 3 Organizer practice | Labor Notes, EWOC, union training guides, union websites | How-to content, union contacts |
| 4 Management-side law firms | Jackson Lewis, McAfee & Taft, Faegre Drinker, Ogletree, etc. | **Tracking legal changes only.** Never cite as advice to workers. Confirm against a Tier 1 source before publishing. |

Tech and security sources (CryptPad, Signal, Yjs, SSB, bitchat, vendor help centers) back the toolkit design, not worker-facing claims.

**Tier 4 in this list:** P1-1, P1-4, P1-5, A8. A5 (Weinberg, Roger & Rosenfeld) is a union-side firm; treat it as Tier 3, but confirm against OLMS.

## Phase 1: law, unions, organizing

| ID | Source | URL |
|---|---|---|
| P1-1 | Jackson Lewis, Aug 2026 | [link](https://www.google.com/goto?url=CAESwAEB6zswFTfWgYB2pTbKVL8HFqxID1-9cOrLbcL7CGqhWqwe_pgHmtfWFS8t7vSMwPyFGruKOrXyHGXJv5fwNEo5HftjnMnZjqxR25vtlsMjksOGuIr51VSNBZn-vMoR2QMruuWEWycesHfKHzUHz2qjndIs5SEaQTAlcjHOrtvqujzm8XqtNMwg1hypQJzfakd3C0ICKO55r6GFrxFaOqQnJV4N_0_GU-1JFfaTGzsxsED2vyAgibqwbeoyxm7MGFU) |
| P1-2 | NLRB GC Memo 26-04 | [link](https://apps.nlrb.gov/link/document.aspx/09031d4584351740) |
| P1-3 | 6th Cir. Brown-Forman opinion | [link](https://www.opn.ca6.uscourts.gov/opinions.pdf/26a0070p-06.pdf) |
| P1-4 | McAfee & Taft, Sep 2026 | [link](https://www.google.com/goto?url=CAESmwEB6zswFW29gsEPDI8wsxbBCxcl8YCBxj3fDcTxto7TUgJuT6uQLwf2nWAZt76gUn39m3WeyspvOWiYByC5qk5jqIPgaqBqqKVFtKkYDMstRk1tEfXWzWwXRx1G0KzmAwZJE2ZXEi_LyQEw4gmeUDIY9b-quk6gkkq0R5IvL850jradZgvTSTNGcOReBEsLvIGEokvhhLx1dvnCzA) |
| P1-5 | Faegre Drinker, Mar 2026 | [link](https://www.google.com/goto?url=CAES4wEB6zswFaUCyVSlR4gzOlTwWqk-elgA_L4VKc5uBwE6ixMcJRsMNa7qRMUVmbTMEr9sovnHwxf5xQW7Ncm6gfC_PBOF1Z8MXaeJw9nSZRSBRaV1dNT0LhA2CKkhHXfEtP_uSKnHduntk_7WkskQpxG6SK6r45m0YVZSJsTwm3Iu90PAvaH7VBblZOWsXMshRfpu-5TOYjWLHWU7IakE16W3sVLxex-2cWhwKFlzw3L2akYWFYudvWcIbZMDSScMvN-hcKo7F-fUuNKlDmOutuiJ2U0eX6kzpu0fVk3gYu5ZFri0DQ) |
| P1-6 | UFCW, Building Your Union | [link](https://www.ufcw.org/union-101-v2/building-your-union/) |
| P1-7 | NPEU | [link](https://npeu.org/contact) |
| P1-8 | EWOC | [link](https://workerorganizing.org/support/) |
| P1-9 | AFL-CIO | [link](https://aflcio.org/contact-union-organizer) |
| P1-10 | New Labor Forum | [link](https://www.google.com/goto?url=CAESrAEB6zswFdaIAYaNeGXU1Pg7Qp_w5Zye_nIWjbJBFLsG0q31PXK97lkoOgGAT_EqV48j7_HiBWNtdVG-onuJSmlFq9lHt3f-gCBFxKv7iAoR6dZQwQ1i0LBZ6adEIzPzkmo0VFTeuZAb1FzJgv_tGQ7v53jMU2hkjWhagdMYr_TyrUinfGvFbyorxkdxGj2iI2eq_kWHCnu9hW5ziA03cgM_0h5y9vy_MVWsbCi1) |
| P1-11 | Starbucks Workers United | [link](https://sbworkersunited.org/organize-with-us/) |
| P1-12 | EPI 2025 | [link](https://files.epi.org/uploads/308564.pdf) |

## Architecture, toolkit and security

| ID | Source | URL |
|---|---|---|
| A1 | Motherboard Guide to Secure Labor Organizing | [link](https://www.google.com/goto?url=CAESjQEB6zswFW83f_q21bttzdcbt4f2QoGZa6PJVZJQwTfklOTxDOFrVCOvqzmZpneyXHk53qDQdCfdvBJ_2U5sGU_a0nBt88Nf7i55W62dFh4o-PuOBN86Xkd1-vNee1zpbXsvBS74Jn-BJEiGHofmdbHOWv356qQje4UEr1Hn-J1orn_QyQzI1Ro2Xw2jvMw) |
| A2 | Eric Blanc, New Labor Forum | [link](https://www.google.com/goto?url=CAESjAEB6zswFQuHZUzK_sGlwSA1pbu5PO9gB3093Kku4UYxfc02JDCiO95IVe9o28rIDODQQe7TRJTRPVX9R8gB0BAdJxSig80DFvSzyYVAQyvZtaQUolez4rHWc_BqIXQxc7TPxIoTUo2GVhX8Mqo02j7vFe93Ho9zB4Nh3pRnUST8PZki56rs2m8m1R4ntg) |
| A3 | Action Builder toolset | [link](https://www.google.com/goto?url=CAESYAHrOzAVcGZAFil8SWGrvvhh0KY1Ljr6y5E5HHru8z4DeIuMC1NBKm0YEKdKs9ZE5V40_oQaUBxUqRR8MBdlR6GTn8Du-zDPvMjXqZfKTJjtwH8YhDwrPHrpitIaNWXAoA) |
| A4 | Labor Notes, Using Your Contract Survey | [link](https://www.google.com/goto?url=CAESgwEB6zswFXTcyVUe2E-QZOOfALnkoU4Vv3Un0IY0GpnoQke3H_k-V49UgKnIzmns-phAC6XUf2UnI0QesYanX4yuXW6_F3-lF3nnaodFSxkRlSjUNZEp6eHtr0ZGjSD8AKy2dvHIs2z0gn1G5Lh_E7U8XZGMTkZJsIfy1blvw1Zusp5t7g) |
| A5 | Weinberg, Roger & Rosenfeld, Jun 2026 | [link](https://www.google.com/goto?url=CAESnQEB6zswFeI6amyYD0NJvgn0fwMuO581MvnBWXAWntB0ZW4MdkcXOqNtSOFsekFImfouTGc6YANdx68t8Vd7uMrKKxAGgCom-DblmaN3uxSvsBcYZFaPfAfeeic3yLaKpkNS0P8DgtvpD1hUzb3JFMWM-rJkCwNzarFfaM3GLinGekqT4NYxx6Iis0nHN6KS83hy6Xe2XeTWPMQMEeuW) |
| A6 | CryptPad on GitHub | [link](https://www.google.com/goto?url=CAESXwHrOzAVRf6mQI3J2_5d__W5DRAcuK6u5_WdbOk15HFR3x0GKh6lKNUDwOjrlDliUM4dtEki-oujdqGd5PL1219euuHlj1lAFvVCwPeM0iauogzFXFt3fhpSJF7R17rd) |
| A7 | Signal blog: usernames | [link](https://www.google.com/goto?url=CAEScgHrOzAVSk2yOx0JTwhS__drfhy3xl8hc_Y5Tr9EVXvEDLTwFTL2zg2JovG1Yz74FhFUp-Q8caYC9CCIhGqVfR99_-ohORWb6IJb_vjysFamEifTUfGs90Uc8ZBMB9_ixAHEjs1Q_LAKppoB8YpmbFRh0g) |
| A8 | Ogletree on GC Memo 15-08 | [link](https://www.google.com/goto?url=CAESugEB6zswFWumb34nh_MFtdi0cSk60PC75r0nvLgwD3PWHRbOVNuiqv2Jv8ZzS2diDu7M7E_Rl74LVQ1N6Iq1RaRTB0-oU2V0lVyULW4XT32DvY7qo7UXKY3K0J_WuWasm7aXyADSlVDsllVDRZ99-KTu2hgECL_3kTNxkGjAqZkB5JpPvtrhbqqfqcXsgbV9_SA_uZhO3Z5VvpvmJMkP84Zp4az2oJhMby9IasGJKh6pEmSd-w6_icHrXWE) |
| A9 | Action Builder Help Center | [link](https://www.google.com/goto?url=CAESmAEB6zswFfTbgtVQ6uJJsT6YBZ0qg10c4zhOWSAK5jH85vT-WjivK0GOB9q7OqEjK2cxlOTAQGrc28rTsb0lETiC3pE2Uy8fGFNVl8_mLXHFeZelsUe5xG6mlCGBEQWO97LT4TePDbxLUazrO4OViNpk8OqsB5ML5M4d-yTC5GAzVySFCQl5KH99Odxmz1LtcRapqKiAbMuiPw) |
| A10 | Wall Chart: Chart View | [link](https://www.google.com/goto?url=CAESkwEB6zswFS780aRC4hONe33hxJYIUbNygyKWcD_00qYV0TyjlE3Vas2GGeTsRY_ZqaUxTwGhLe3wsqXyfCqRhydTZVVupzYvRkeAKyMuOnO3rY9zYOsOLaldwKZLvAXB0eBc427UNysr1jomf8kRrXTdZxT2MrDpxnivJe8LosAWOmvDAejk2apn9HFGmic0_ZsR5Ds) |
| A11 | Action Builder Toolset | [link](https://www.google.com/goto?url=CAESYAHrOzAVWqWWcqujAIhWgNWuPcjKLXUBfhbqN0irXr2Mubn7_82l-VTITwabHNxYUJhQrlE2rmOMn6t2wL-lqCBCLT4h3_8NoJGSp85oknXScasCQp0UVNv5DJxX_6yltw) |
| A12 | Broadstripes, How it works | [link](https://www.broadstripes.com/how-it-works/) |
| A13 | Solidarity Tech for Unions | [link](https://www.google.com/goto?url=CAESYQHrOzAVgSnKsrEr4FYEmSsPi9n3U8Ws4y4lZqQZLq9_LhNlxAwkOmDTm8do483ZwMALtWwYrOk9zZylfLHHVu5XWeS9MNNpvbM1Msr2gXYUFOYFT81ng_NCRTQrhj2i8Gc) |
| A14 | Union Strong | [link](https://www.google.com/goto?url=CAESVgHrOzAVbk_G4FcPiOM07z67Cc-aZnMCWJz4KwZRfepL6gXUVan4OKvszherqr6skqWjaO9RGta-TiS6TVftbv_rr8PgObv2eoBf9OtLDbkvFMdUYYJb) |
| A15 | Coworker.org | [link](https://home.coworker.org/) |
| A16 | EWOC, Get Support | [link](https://workerorganizing.org/talk-with-an-organizer/) |
| A17 | Signal Support: Group chats | [link](https://www.google.com/goto?url=CAESgAEB6zswFRKMK0RPxwUEeMfUdp3gIXdWJGfh25dDGuwEchAJzobIPv5EHVBzewMSiwPUAHuZ482vKJs45FlGKVz5tG6kaK9arubezRzyJdi-GmDmFLB_TKFQ57WpCs3XyeUKpwBYFMJPo5Dx3U4HKnKX-AqEP4hF5bb8PqNc5P6uFQ) |
| A18 | CryptPad docs: Kanban | [link](https://www.google.com/goto?url=CAEScwHrOzAVgCTzwkMEd2enBkh94VlMTqGV53cl9X-MYrZMrXrkP8d8tv84Zsznu79b5yvK9ukQlKfRSIdkDdBkgIq_h9JK7wk3-pPH3bXykwCUWG6FHCMPfEbJviGfm63LPSfyv1x1de-lolt7ZcuY76gXepk) |
| A19 | Tella on Google Play | [link](https://play.google.com/store/apps/details?id=org.hzontal.tella&hl=en_US) |
| A20 | Ink & Switch, Local-first software | [link](https://www.google.com/goto?url=CAESagHrOzAVXAiN4gEWChcZx-pG_dmFZqqOp4_06nRHx9YIQD8r6yt0mm0nl0BzgwQHrDidcI7Cqc_mfs5_7pqUUnvB0bKZvZyWEeiOINBpD-42BWKKKRNVnM2Wjfwo4ITflHV4a70cQf0ZyBE) |
| A21 | OpenPWA, iOS storage | [link](https://www.google.com/goto?url=CAESdgHrOzAVSF3TCJAC90V76IhPiKexB98LQESbKsp8CcQdtORQz3nP4A5M2TPxn0pARI8Cw1bht7muUOn2Bv6ZOUF1SiLPatRcLHeiwmPdWPGz4CwKLtwfUsv4_GbsGBwuKVGr1OoQ6JunVAJZEolLqcUnyJWnbVM) |
| A22 | y-webrtc on GitHub | [link](https://www.google.com/goto?url=CAESWgHrOzAVdGyUONyxsODPcqgc4tTdwkk540NxLyyqyYy9kwTKpGYv4EmQT0DMBBfaxdnD0PHNAhHL9Rysyh9TTXyodAe4jfQ42LcXtldKKlpHCvHJXt-hQE4b5g) |
| A23 | SSB Rooms 2.0 spec | [link](https://www.google.com/goto?url=CAESWQHrOzAV3VbugUyN8q0vLHY9DZWuD8VrnmvEs_HpWwdX6HtaN3WKE78GM9ihmCPYZzKPYv9e2T8Aa4uSvFH47wGtPvjbRyDGP2MCbncIxdiIbNEuEvZf7XRh) |
| A24 | Scuttlebutt Protocol Guide | [link](https://ssbc.github.io/scuttlebutt-protocol-guide/) |
| A25 | bitchat on GitHub (whitepaper) | [link](https://github.com/permissionlesstech/bitchat) |
| A26 | SSB private-groups spec | [link](https://www.google.com/goto?url=CAESZQHrOzAVE5dHJrFSh_emF042trhYd5RpB1cwzgNZdNWYIXGU3uKvb5_iRJR9x6EbnCYV7JPLqrS48YurIwOSr5vNZQpJHRJdsHYOJTP0FSV_AUeUaz6kVZBS3ZbWvi8dRblGO-xf) |
| A27 | Manyverse: My last update | [link](https://www.google.com/goto?url=CAESYgHrOzAVBl2zaodEh-VFWf3htnCbilnDTNp30v6NbsuvKShcmKHCZuj_5GGgdun6-C-jeQ_bZWlGJZxyZblhXRdrTyXqMbEkghfmX7C4LriozbODsjsM1mWHwtNFlDbl4gxc) |
| A28 | Launch of PZP | [link](https://www.google.com/goto?url=CAESYgHrOzAVfCaZYGulEy7rRYxnsQDpDGUehxla1_cOYO1XR4cGd9E7PAunMTVqTpDLFoi8mktiULHL3czvHfykSX09x8BBfmEFU7sWgIdWB490epdcqIJ0KwBliSIdIVVyNEdp) |
| A29 | LWN: Sharing stories on Scuttlebutt (Apr 2026) | [link](https://www.google.com/goto?url=CAESXAHrOzAVvo6HvMwOrTokPGQ4J9otlNptSz6zdn7_DWAoaTfCk6kP_rd5dvmLPogM8M-KQ8bSJPrmFl59jMuTLHr2vfZDVZMEXNQAa_D5LKJ41RfDY8ww6wrjzDaf) |

## Organizing handouts (Labor Notes, EN + ES)

- *Secrets of a Successful Organizer* exercises: An Organizing Conversation; How to Be a Good Listener; Inoculate Your Co-Workers Against the Boss's Tactics; Ten Questions to Ask When Mapping Your Workplace; When You're Called Into the Office. `TODO(verify)`: record the exact URLs on labornotes.org.
- EFF Surveillance Self-Defense: https://ssd.eff.org/

## Storage protocols (added 2026-10-26)

| ID | Source | URL |
|---|---|---|
| A30 | The remoteStorage Protocol | [link](https://www.google.com/goto?url=CAESXAHrOzAVBnK3wMFCZk7yEHOJ_kzaab3r5uJpFTI8-tmrMAOGRVBwlP5vXysuaOLk8KZi8KlcLSQPRV2VymMiSwy3mH4p_z8A_wzoEbPj3sbS6qLHpY8hqVQJ8ORx) |
| A31 | remoteStorage.js on GitHub | [link](https://www.google.com/goto?url=CAESbQHrOzAVLr839d7Ufy2LlB5RhvcKNFWMwF9Qdpr8QhD0gpVZTyrtStsDINNKKau1_D6p9Uq5wbJMQzsJGbZA-cZnTa6qStATgKxNWnBBvs7n2PgrprX-eTQHQEqiQ68RWsq5PAJ7oN1TLwnJoAA) |
| A32 | Atproto spaces proposal (0016) | [link](https://github.com/bluesky-social/proposals/tree/main/0016-permissioned-data) |
| A33 | Atproto blog: The Atproto Spaces Alpha is Live (Aug 20, 2026) | [link](https://atproto.com/blog/atproto-spaces-alpha) |
| A34 | Solid forum: Encrypted POD? | [link](https://www.google.com/goto?url=CAEStAEB6zswFWBEiu3kj2CzmJpNsboBkpo9l_QNYyxX5UuB5wAyMeb55dJaj3nTTQpAVii7hBZSy6IjrctjqRpy4tXHQaq_EFR4dh-X8DWuMVHcMvJ0NeXdxnrDnvWC0VyNfzHntaGWHpBV50NH1YRjuOiznSiiIqfv5GVKbFGJuqjMk8dCZxiA4Rl2f3ZR3yG_f3MXwtFCMUGAVkj_rRXeFAf2GXu1KaARAHNQSdontxO4ylo-qDY) |

## Stack, hosting and 2026 legal updates (added 2026-10-26)

| ID | Source | Link |
|---|---|---|
| A35 | Coolify Docs: One-click Service catalog (lists PocketBase, Glitchtip, Umami) | [link](https://www.google.com/goto?url=CAESZAHrOzAVWBe3oYz-xgZvF3pNff1Eaa_Y1JbroLRtkF0qYRE2OUf9MZAuJvMEf4n8Y5m7VKGcl3E5UXwvlnaG8MDWWHfxwDyScO59qJNVAFcnXiukxgfdLAeATr7homI3pgPvavU) |
| A36 | Astro Docs: Internationalization (i18n) Routing | [link](https://www.google.com/goto?url=CAEScwHrOzAVOKiLt72CwgbRE7EkRf3vm1oKaC5oM72CbZFHMIbdqIDdREv30WIYY-YRHWtOTkYMYpNhjuiTua7se52JfJmVK5z6l1v-k83bAHHo7BqL_9yajcrL6lAf9CGasxv6Y9gx9YecOuCC6Bf_ng0KuvM) |
| A37 | PocketBase source, new home after leaving GitHub (old repo archived) | [new](https://ganigeorgiev.com/pocketbase/pocketbase) · [old](https://github.com/pocketbase/pocketbase) |
| A38 | PocketHost FAQ: "does not back up your instance data"; volume "not encrypted at the OS level" | [link](https://www.google.com/goto?url=CAESWQHrOzAVNrCN_ZIHufbA6PCJbSjGk2U53XiOEGjXoAZcqQaVu1w1z5-3MWu97yT6Kr0daFTcndBmW5Yz5sZ_Uesa8PIe2tO6gBmsH1to-W-XXlU-ElAwCVUd) |
| A39 | PocketBase docs (Logs settings: "Max days retention", 0 disables logs) | [link](https://pocketbase.io/docs) |
| A40 | GlitchTip install and configuration docs (retention and feature env vars) | [link](https://glitchtip.com/documentation/install#configuration) |
| A41 | Umami GitHub Discussion #2929: "Is Umami still privacy focused and GDPR compliant" (pseudonymous visitor ID) | [link](https://www.google.com/goto?url=CAEScwHrOzAVEt9-qLzoPZSwsFlkxcCySPa5q_ts-rTOXJemB98prLwNn5NnsNk-mRTsd7PrOgftya6v6y8a_xgZXhdwIxNp_lmitNT3ZhQtZ2hVK5k8qmbxnpwB-kxH3aGLTmmp8xeiOS1ztmgea8bpICqHM88) |
| A42 | NMB final rule: 50% showing of interest (77 FR 75543, Dec 21, 2012) | [link](https://www.federalregister.gov/d/2012-30853) |
| A43 | NMB final rule: majority of valid ballots cast decides (75 FR 26088, 2010; 29 CFR 1202.4) | `TODO(verify)`: add Federal Register link |
| A44 | Sheppard Mullin: Captive Audience Meetings: Prohibitions Remain on Hold (Oct 3, 2025). Tier 4: change tracking only. | [link](https://www.google.com/goto?url=CAESmAEB6zswFQZfSTyswU9jQGYJiH6QqiQPtaGJAt8XeG7U3G2kChj6MNeMWFXpYGbln70LI05O09og7FChmoOPQELrW3OrR4EstUF8WiLy1wYrRDHBeyWRHniHMnB3GDy0bY1SjdVw2rHiir8ozNEGfmV01OiFMkSoj4DD9ZezN_63z5_VOso1w-hOz01yoF9srbSLWsni1nPp_w) |
| A45 | Fisher Phillips: NLRB now has enough votes to overturn policy. Tier 4: change tracking only. | [link](https://www.fisherphillips.com/en/insights/insights/nlrb-now-has-enough-votes-to-overturn-policy) |
| A46 | NLRB GC Memo 25-05 (Feb 14, 2025; rescinds the previous GC's memos) | [link](https://apps.nlrb.gov/link/document.aspx/09031d4583f3f58c) |
| A47 | IATSE: Join / Contact an Organizer | [link](https://iatse.net/join/) |
| A48 | Shipman & Goodwin, Employment Law Letter: NLRB Acting General Counsel Rescinds Biden-Era Guidance (Feb 20, 2025). Tier 4: change tracking only. | [link](https://www.employmentlawletter.com/2025/02/nlrb-acting-general-counsel-rescinds-biden-era-guidance/) |
| A49 | NLRB final rule: Representation-Case Procedures (88 FR 58076, Aug 25, 2023) | [link](https://www.federalregister.gov/d/2023-18129) |
| A50 | astro-loader-pocketbase (README) | [link](https://www.google.com/goto?url=CAESbwHrOzAV4MQK0GYfFNRTqaYNlK9zTPoKFndBBu-zYtrsOXbcYvU4q3nZdZDF5AKcwbPMA8LccMpyqzkgZZJsIE0CEE-Cl6uIeiIjYeZQVn5Cf7En-epLVsSHJ_g6QmGLU049aWw17EpNxqw61GWxwA) |
| A51 | NUHW: Join (organizer form) | [link](https://home.nuhw.org/join/) |
| A52 | UE: Organize a Union in Your Workplace | [link](https://www.ueunion.org/organize.html) |
| A53 | Umami docs: FAQ (data collected; self-hosted data kept until deleted) | [link](https://umami.is/docs/faq) |
| A54 | Umami docs: Environment variables (SALT_ROTATION, PRIVATE_MODE, DISABLE_TELEMETRY, etc.). Session hash detail confirmed in Umami GitHub issue #4108. | [env vars](https://umami.is/docs/environment-variables) · [issue](https://www.google.com/goto?url=CAESbgHrOzAVReg_uSmrO8F8qBoOU1F8Mw7dUAzaaHNT-vygKfvpTeRStGxtmTwf4m3GQBduvyLIiIkFCixgITwP4F-WAo509zW8jXUa9UbeOgsptJF4K6H6SSL9Q4qM4fY6rGcX7zO4sCFr0NfsuzWe) |
| A55 | Umami docs: Tracker configuration (data-exclude-search, data-exclude-hash, data-do-not-track, data-domains, data-before-send) | [link](https://umami.is/docs/tracker-configuration) |
| A56 | Umami docs: Replays (recorder.js, 15% default sample, 30-day storage) | [link](https://umami.is/docs/replays) |
| A57 | Action Builder Help Center: How to Properly Format and Upload CSV Files | [link](https://www.google.com/goto?url=CAESvAEB6zswFer33p0XvbErKvay3BVdXXL-uE9NRLOIXOTtN8S-6714k4KFV6kkwegY_362moATDJVFRrtb01dwaI5HdsbMjTg16YT7UtsnDKOhQS4p1oT-e_rIAM6Kf1XKgR3cJt7aFnPBuevr2OB9SIxNAlgUZPZUFONvvwpbdZcZ4HBXGBUzMwzDE2LowskSmFoYB-eD6Byy0KWTow4Y0EWHlUy_LluZ_S95zVU0nBbC9BaEViKYCEjmtsYjgw) |
| A58 | Broadstripes Help: Prepare your data for import | [link](https://help.broadstripes.com/docs/data-import-admin/data-sources.md) |
| A59 | Broadstripes Help: Data import fields; Update existing contacts with an import | [fields](https://help.broadstripes.com/docs/data-import-admin/data-import-fields.md) · [matching](https://help.broadstripes.com/docs/data-import-admin/update-contacts-with-an-import.md) |
| A60 | Broadstripes Help: Built-in fields | [link](https://help.broadstripes.com/docs/admin-guides/data-tools/broadstripes-built-in-fields.md) |
| A61 | Actors' Equity: Organize Your Workplace | [link](https://actorsequity.org/join/organize-your-workplace/) |
| A62 | WGA East: Contact An Organizer | [link](https://www.wgaeast.org/organize/contact-an-organizer/) |
| A63 | AFSCME Cultural Workers United | [link](https://www.culturalworkersunited.org/) |
