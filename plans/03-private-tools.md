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
