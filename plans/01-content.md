# 01 Content

How to write and structure every page. The full page tree is in `data/sitemap.txt`. Facts below were checked on **2026-10-26**. Re-verify anything legal before publishing; the NLRB is actively reversing precedent.

## Global chrome (every page)

- **Top nav, in campaign order:** Start Here · Your Rights · Organize · Find a Union · Win the Vote · Win the Contract · Run Your Union · Toolkit.
- **Secondary sections outside the nav:**
  - *Make the Case* (`/case`), linked from every Organize and Vote page.
  - *Get Help* (`/help`), reached from a red **"Boss retaliating? →"** button on every page.
- **Quick Exit:** a visible button plus pressing Esc twice. It replaces the current tab with a neutral site using `location.replace()`, so Back doesn't return here. The pattern comes from domestic-violence hotline sites.
- **First-visit banner:** "On a work laptop, work phone, or work Wi-Fi? Close this and come back on your own phone." Many company devices can be monitored remotely by IT [A1]. Remember dismissal in `localStorage` only.
- **Footer:** Not legal advice · Privacy (we keep nothing) · Sources & methods · Changelog · Español.
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
| **E-signature authorization cards** (GC 15-08, 2015) | Allowed, with specific required fields [A8]. `TODO(verify)`: confirm it is still in force. | Sign cards through the union's process. |

**What hasn't changed:**
- Section 7 still protects talking with coworkers about pay and conditions, union or not.
- You have 6 months from the violation to file a ULP charge.
- An election petition needs a showing of interest from 30% of the unit. Organizers advise reaching 70% first [P1-6].
- Weingarten rights (bringing a representative into a disciplinary meeting) apply only once you have a union.

**Union finance reporting (Run Your Union):** for fiscal years starting July 1, 2026, a union with receipts under $25,000 files the LM-4; $25,000–$350,000 files the LM-3; $350,000 and up files the LM-2 [A5]. Local officers must be elected by secret ballot at least every 3 years.

**`TODO(verify)` before publishing:**
- RLA showing-of-interest and voting rules (NMB).
- GC 15-08's current status.
- State captive-audience ban list.

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
- [ ] State-law table (captive-audience bans, etc.).
- [ ] RLA rules for airline and rail pages.
