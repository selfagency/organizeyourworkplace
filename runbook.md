# Runbook — organizeyourworkplace.com

Keep this current with every infrastructure change (00-roadmap.md R0.9, 07-stack-and-hosting.md O1–O2).
Status: **skeleton**. Owner-specific values are `TODO(owner)`.

## Services

| Subdomain | Service | Image (pinned) | State | Notes |
|---|---|---|---|---|
| `www` / apex | Astro static site | built from this repo | deployed from `dist/` | headers at proxy (H4) |
| `app` | Workspace app (R3) | — | not built | separate build, signed releases |
| `mbx` | PocketBase `mbx` (mailbox) | PocketBase `TODO(owner): pin version` | not deployed | logs off (P6), no backups (P11) |
| `sig` | Matchmaker (in-memory) | — | not built | never PocketBase |
| `turn` | TURN relay (coturn) | — | not deployed | |
| `errors` | GlitchTip | `TODO(owner): pin version` | not deployed | private, VPN-only (G2) |
| `cms` | PocketBase `cms` (content) | `TODO(owner): pin version` | not deployed | private, VPN-only (P1) |
| `pad` | CryptPad (R2) | — | not deployed | needs owner go (06 #2) |
| `/s/` | Umami (first-party path) | Umami `3.x` pinned (U0) | not deployed | content pages only |
| `/e/` | GlitchTip tunnel | — | not deployed | strips IPs (G3) |

## Ports and firewall

- Public: 80/443 only, plus TURN ports (`TODO(owner): 3478 + relay range`).
- Everything else behind the VPN/tailnet (`TODO(owner): which`).
- Coolify dashboard: VPN-only, 2FA on (H1).

## Environment variables

Templates live in `deploy/` (Phase C). Secrets never enter the repo (H7).

- `ASTRO_TELEMETRY_DISABLED=1` — set in every build (A2, verified current).
- PocketBase `mbx`: logs retention `0` (P6). Verify after every upgrade.
- GlitchTip: `GLITCHTIP_RETENTION_DAYS=14`, `GLITCHTIP_ENABLE_UPTIME=False`, `GLITCHTIP_ENABLE_LOGS=False`, `ENABLE_USER_REGISTRATION=False` (G1).
- Umami: `DISABLE_TELEMETRY=1`, `DISABLE_UPDATES=1`, `PRIVATE_MODE=1`, `SALT_ROTATION=day`, neutral `TRACKER_SCRIPT_NAME`/`COLLECT_API_ENDPOINT` under `/s/` (U0).

## Backups (H5)

- Back up: PocketBase `cms`, Coolify config, CryptPad. Encrypted, offsite, tested monthly.
- **Never back up the mailbox** (`mbx`) — short-lived scrambled data only.
- `TODO(owner): backup target and schedule`.

## Restore drill

`TODO(owner): document the monthly restore test once backups exist.`

## Upgrade steps (PocketBase is pre-1.0)

1. Read the release notes at `ganigeorgiev.com/pocketbase/pocketbase` (the project left GitHub; the old repo is archived) [A37].
2. Test the upgrade on a copy first.
3. After upgrading `mbx`: re-verify logs are off (P6) and the `queue` collection still rejects >31-day `expires_at` (P8).
4. Pin the new version in the Compose file; never auto-upgrade (AGENTS.md rule 22).

## Incident contacts

- Operator: the owner (`TODO(owner): name + contact`).
- Lawyer on standby for legal demands: `TODO(owner)` — required before R2 launch.
- Second person with server access: **open decision** (06-open-decisions.md #2).

## Transfer checklist (O2)

1. Domain registrar transfer, DNS, TLS.
2. Coolify rebuild on the new org's server from the repo (H7: Compose files, env templates).
3. Restore `cms` from backup or the git export (`data/*.json` is the source of truth, P4).
4. Rotate every secret.
5. New GlitchTip and Umami owner accounts; delete the old ones.
6. Publish a changelog note.
7. Workspace continuity (O3): stand up `mbx`, `sig`, `turn`; the app's next signed release points to them; run old and new servers in parallel for one retention period (up to 1 month).
8. Legal handover (O4): the new operator takes over the legal-request policy and the privacy promises.