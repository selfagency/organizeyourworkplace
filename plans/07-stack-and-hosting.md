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
