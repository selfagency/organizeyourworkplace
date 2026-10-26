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

- [ ] **R0.1 Static site skeleton.** A static site generator with content in Markdown + front matter, and structured data in `data/`. Server-side analytics off. No third-party requests. Strict CSP header template (see `05-security.md` §Web hardening).
  - Accept: `curl -I` shows CSP, HSTS, `Referrer-Policy: no-referrer`, `Permissions-Policy`; the network panel shows only first-party requests.
- [ ] **R0.2 i18n.** EN/ES routing (`/es/...` mirror), string catalogs for all UI, a language switcher that keeps the same page.
- [ ] **R0.3 Global chrome.** Top nav (8 items), red "Boss retaliating? →" button, Quick Exit (button + Esc×2), first-visit work-device banner, footer. Spec: `01-content.md` §Global chrome.
- [ ] **R0.4 Content schema + page templates.** Front matter fields in `01-content.md` §Page template. Legal pages render the as-of stamp, not-legal-advice notice and changelog link automatically.
- [ ] **R0.5 Data layer.** Load the records in `02-data-model.md` at build time. Validate against JSON Schema; the build fails on invalid records.
- [ ] **R0.6 Changelog.** `/rights/whats-changed`, generated from legal-rule records' `history` field.

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
- [ ] R1.10 About: sources and methods, source tiers, changelog, privacy ("we keep nothing"), corrections form (no account; see `05-security.md`).
- [ ] R1.11 Spanish versions of everything above. Translation by a human translator fluent in labor terms is preferred: flag in `06-open-decisions.md`.

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
- [ ] R3.6 Matchmaker, relay and mailbox servers.
- [ ] R3.7 Removal + re-key; 2-of-3 recovery; encrypted backups.
- [ ] R3.8 Screens 0–11.
- [ ] R3.9 Union handoff export (needs Action Builder and Broadstripes import formats; see research gaps).
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
