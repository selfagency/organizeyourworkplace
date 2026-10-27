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
- [x] R1.1 Start Here: router page, 8-stage roadmap, honest risks, Union 101.
- [x] R1.2 Your Rights (all `[!]`): Section 7, TIPS/FOE, coverage sub-pages, state laws, legal tracker.
- [x] R1.3 Organize: first conversation, listening, mapping, leaders, committee, inoculation, fear, actions, security (+3 sub-pages), high turnover, remote.
- [x] R1.4 Find a Union: matcher page, sector pages, union and local profiles (generated), how to pick, first call, independent, no union yet.
- [x] R1.5 Win the Vote (all `[!]`): cards, recognition, petition, the unit, boss campaign, captive meetings, answers to top 15 boss arguments, election day, timeline.
- [x] R1.6 Win the Contract: first contract, survey, demands, bargaining committee, campaign/escalation, strikes `[!]`, compare.
- [x] R1.7 Run Your Union: bylaws, officer elections `[!]`, dues and money `[!]`, stewards, grievances, keep organizing.
- [x] R1.8 Make the Case: talking points, numbers, myths, stories.
- [x] R1.9 Get Help (all `[!]`): retaliation (do-this-today), file a charge, NLRB office finder, lawyers, worker centers.
- [x] R1.10 About: sources and methods, source tiers, changelog, privacy (honest version: page counts without IPs, error reports kept 14 days, tools and workspace never counted; see `07-stack-and-hosting.md` U6, G7), corrections form (no account; see `05-security.md`).
- [x] R1.11 Spanish versions of everything above (confirmed by the owner). An agent drafts; a human fluent in labor Spanish reviews every `[!]` page before it goes live. Who reviews is still open (`06-open-decisions.md` #8).

### Data (`02-data-model.md`)
- [x] R1.12 Verify every `TO VERIFY` row in `data/unions.csv`.
- [x] R1.13 Build the OLMS local-level dataset (bulk download → `locals.json`).
- [x] R1.14 Sector records with plain-language job lists.
- [x] R1.15 Legal-rule and state-law records (start from `01-content.md` §Legal status).
- [x] R1.16 Help-resource records (NLRB regional offices, worker centers, lawyer directories).

### Tools (`03-private-tools.md`)
- [x] R1.17 Router. R1.18 Coverage checker. R1.19 Union matcher. R1.20 "Is that legal?" decoder. R1.21 Conversation builder. R1.22 Deadline calculator. R1.23 Wallet card. R1.24 Employer research. R1.25 Election timeline calculator. R1.26 Inoculation builder.

### Gate
- [x] R1.G (agent part) `review-packet.md` generated (`docs/review-packet.md`, 56 pages, 0 unresolved refs). Gate stays with the lawyer: 🔒 Lawyer review of every `[!]` page. listing each page, its claims, and their sources.

## R2: Committee kit

- [x] R2.1 CryptPad deployment plan (subdomain `pad.`), hardening checklist, backup policy (`deploy/cryptpad-plan.md`). **Don't deploy without the owner's go** (`06-open-decisions.md` #2).
- [x] R2.2 CryptPad templates: wall chart spreadsheet, one-on-one tracker board, issue board, action planner, bargaining survey form, meeting notes (`deploy/cryptpad-templates.md`). Spec: `04-workspace-app.md` §R2 templates.
- [x] R2.3 Signal guides: setup with username, disappearing messages, group templates (Committee, Trusted contacts), admin approval, what to do if a phone is taken (`/organize/security/signal-setup`, `/organize/security/if-your-phone-is-taken`).
- [x] R2.4 Retaliation evidence log (`03-private-tools.md` §Evidence log): `/toolkit/evidence-log`.
- [x] R2.5 Privacy policy (shipped as /about/privacy draft in R1.10) and legal-request policy drafts → owner and lawyer.
- [ ] 🔒 R2.G Server hardening review.

## R3: Workspace app (`04-workspace-app.md`, `05-security.md`)

- [ ] R3.0 Paper prototype of screens 1–4 → 5 usability sessions with non-organizers (human-run; the agent prepares scripts and prototypes). Agent part shipped: `docs/r3-usability/prototypes/` + `docs/r3-usability/session-script.md`. The 5 sessions are still owed by the owner, and they gate screens 1–4 polish, not the R3.1–R3.5 code.
- [x] R3.1 Threat model doc and protocol whitepaper draft (`docs/r3-threat-model.md`).
- [x] R3.2 Local storage layer (encrypted IndexedDB, persistence request, iOS Home Screen gate) (`src/lib/workspace/storage.ts`).
- [x] R3.3 Data model on Yjs (Automerge as fallback); evaluate existing encrypted Yjs sync servers first. Edits are deniable: MAC with the room key, no per-device signatures (`05-security.md` §Deniable edits). (`src/lib/workspace/model.ts`, `envelope.ts`; survey in `06-open-decisions.md`.)
- [x] R3.4 Keys and invites (one-time, device-bound, 4-word check code). (`src/lib/workspace/keys.ts`, `invite.ts`, `wordlist.ts`.) The invite screen itself lands with R3.8, which builds screens 0–11.
- [x] R3.5 Rooms (Core / Point person / Committee) and the permissions matrix (`src/lib/workspace/rooms.ts`).
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
