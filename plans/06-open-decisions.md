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
- [x] Union intake links resolved 2026-10-26 (R1.12):
  - **SEIU national:** no national intake form exists; route via the homepage Local Union Locator (https://www.seiu.org/). Locals list their own forms.
  - **SEIU 32BJ:** no organizing intake page; same locator route.
  - **NABTU:** no trades-wide intake exists (finding, not a gap). Route by craft local; AFL-CIO fallback verified.
  - **AFSCME CWU:** AFSCME-wide form verified (https://afscme.org/join/form-union/); routing to CWU unconfirmed — row stays partially_verified.
  - **SAG-AFTRA:** no intake form; organizing phone/email verified on sagaftra.org/contact-us.
  - Airline rows: still partly verified (AFA organizing page unconfirmed).
- [ ] GC 15-08: confirm against the GC 25-05 PDF itself. The PDF didn't render here.
- [ ] NLRB jurisdiction thresholds: believed to be $500k gross for retail and $50k inflow/outflow for nonretail. The nlrb.gov page didn't render; confirm there.
- [ ] Median days from petition to election under the 2023 rule (NLRB election statistics).
- [x] Action Builder and Broadstripes import formats: now in `04-workspace-app.md` §Hand-off export formats. Remaining: Action Builder's sample CSV, the Broadstripes header list, and a live demo with a friendly organizer.
- [x] Umami: data collected, defaults and settings, now in `07-stack-and-hosting.md` §Umami. Remaining: the Postgres table names for the purge job.
- [ ] Labor Notes URLs for the cited books and guides.
- [ ] Usability sessions on paper prototypes (screens 1–4).
- [ ] Content: answers to the boss's top 15 arguments; phase 6 bargaining content; remote organizing.

## Agent assumptions
- T10 employer research (R1 scope): option 2 from the plan — the tool opens the official search pages (OLMS, NLRB, OSHA, ProPublica) in a new tab and tells the worker the official site will see the search. No proxy, no bundled indexes yet. Bundled indexes stay a possible R2 upgrade. (Agent assumption, reversible.)


When a plan was silent and you made a call, log it here in this format: date · task · assumption · why · reversible?

- 2026-10-26 · R0.5 data layer · union records carry optional `recent_example`, `intake_note` and `local_finder_note` strings carried over from `unions.csv` · keeps directory v1 data lossless until `campaign` records exist (schema's `recent_wins` needs campaign ids that don't exist yet) · reversible: drop the fields when campaigns land
- 2026-10-26 · R0.5 data layer · SEIU split into `seiu` (national) and `seiu-building-services`; UAW into `uaw` and `uaw-higher-ed` · the CSV has two rows per abbreviation and record ids must be unique slugs · reversible
