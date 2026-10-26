# Infra as code (H7)

Everything needed to rebuild the stack on a fresh Coolify box. Secrets stay out
of the repo — copy `env/*.example` to real files and fill them in.

| File | What |
|---|---|
| `docker-compose.yml` | cms (PocketBase), mbx (PocketBase), GlitchTip, Umami + Postgres |
| `pocketbase.Dockerfile` | Builds PocketBase from a pinned release binary |
| `env/*.example` | Env templates per service (G1, U0, P6 rules baked in) |
| `proxy/Caddyfile` | Reference proxy config: security headers (H4), `/s/` Umami path with IP stripping (U0c), `/e/` GlitchTip tunnel (G3), access logs off (H3) |
| `proxy/traefik-dynamic.yml` | The same rules as a Traefik dynamic config (Coolify's default proxy) |

## Pinning (AGENTS.md rule 22)

Every image tag is `TODO(owner): pin` — fill in the exact version before the
first deploy and never auto-upgrade:

- PocketBase: release binaries from `ganigeorgiev.com/pocketbase/pocketbase`
  (the project left GitHub on 2026-10-26; the old repo is archived) [A37].
- GlitchTip: `glitchtip/glitchtip` on Docker Hub.
- Umami: `ghcr.io/umami-software/umami` (v3.x line, U0).
- Postgres/Redis: current stable major, pinned minor.

## Deployment order

1. Harden the box first (H1–H6) — see `runbook.md`.
2. `cms` and `errors` are **private**: reachable only over the VPN/tailnet (P1, G2).
3. `mbx` is public but hardened: logs off (P6), admin UI blocked at the proxy (P10), no backups (P11).
4. Umami and the GlitchTip tunnel are reached only through the site's first-party paths `/s/` and `/e/` (U2, G3).
5. After every PocketBase upgrade: re-verify `mbx` logs are off and the 31-day cap still rejects (runbook §Upgrade steps).