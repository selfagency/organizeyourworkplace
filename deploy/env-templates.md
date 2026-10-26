# Env templates (G1, U0, P6)

Copy each block into the service's env file on the box and fill in `TODO(owner)`.
Secrets never enter the repo (H7). Real env files are gitignored via `.env*`.

## cms (PocketBase, private content instance — P1–P5)

```sh
# Superuser credentials for setup only; rotate after first login.
PB_SUPERUSER_EMAIL=TODO(owner)
PB_SUPERUSER_PASSWORD=TODO(owner)

# P6: PocketBase records every request including IPs by default.
# Set Logs -> Logs settings -> Max days retention = 0 in the admin UI
# (0 disables logs entirely), then verify after every upgrade.
```

## mbx (PocketBase, public encrypted mailbox — P6–P11)

```sh
PB_SUPERUSER_EMAIL=TODO(owner)
PB_SUPERUSER_PASSWORD=TODO(owner)

# P6: logs off (same admin-UI setting as cms; verify after every upgrade).
# P7: one collection `queue` (label, blob, expires_at). No accounts, no relations.
# P8: client sends expires_at; a hook refuses anything over 31 days; hourly
#     cron deletes expired rows and runs VACUUM.
# P9: rate limits and size caps per label (proxy + hook).
# P10: block /_/ at the proxy — no admin UI on the public subdomain.
# P11: never back up this instance (H5).
```

## GlitchTip — G1–G5

```sh
SECRET_KEY=TODO(owner)-generate
GLITCHTIP_DOMAIN=errors.organizeyourworkplace.com

# G1: 14-day retention (default is 90).
GLITCHTIP_RETENTION_DAYS=14

# G1: disable unused features.
GLITCHTIP_ENABLE_UPTIME=False
GLITCHTIP_ENABLE_LOGS=False

# G1: no self-registration after the owner account exists.
ENABLE_USER_REGISTRATION=False
ALLOWED_HOSTS=errors.organizeyourworkplace.com

# Postgres/Redis for the GlitchTip stack.
POSTGRES_HOST=glitchtip_postgres
POSTGRES_PORT=5432
POSTGRES_DB=glitchtip
POSTGRES_USER=glitchtip
POSTGRES_PASSWORD=TODO(owner)
REDIS_HOST=glitchtip_redis
REDIS_PORT=6379
```

## Umami v3 — U0–U6

```sh
DATABASE_URL=postgresql://umami:TODO(owner)@umami_postgres:5432/umami
DATABASE_TYPE=postgresql

# U0: no telemetry, no update checks, no outside network calls.
DISABLE_TELEMETRY=1
DISABLE_UPDATES=1
PRIVATE_MODE=1

# U0: rotate the visitor salt daily so counts can't be tracked across days.
SALT_ROTATION=day

# U0: neutral first-party paths under /s/ (U2). The proxy maps /s/* to this
# container and strips the client IP (U0c).
TRACKER_SCRIPT_NAME=/s/script.js
COLLECT_API_ENDPOINT=/s/collect

# U0b: never enable replays, heatmaps, distinct IDs, revenue or pixels.
# CI fails if recorder.js, data-distinct-id or umami.identify appear in builds.
```