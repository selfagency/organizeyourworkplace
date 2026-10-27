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
#     The collection rules are superuser-only: the public door is mbx_guard.
# P8: the client sends expires_at; mbx_guard refuses anything over 31 days;
#     an hourly job deletes expired rows.
# P9: rate limits and size caps per label (proxy + guard).
# P10: block /_/ at the proxy — no admin UI on the public subdomain.
# P11: never back up this instance (H5).
```

## mbx_guard (the public door to the mailbox — P7–P9)

```sh
# The guard is what the proxy points at. PocketBase itself has no public port.
PB_BASE_URL=http://mbx:8090
PB_TOKEN=TODO(owner): a PocketBase superuser token that can write the `queue` collection
PORT=8080
```

## sig (matchmaker — 05-security §Matchmaker hardening)

```sh
# The matchmaker holds everything in memory and writes no log line.
PORT=8090
POW_DIFFICULTY=4
MAX_PEERS=8
JOINS_PER_MINUTE=10
QUEUE_LIMIT=200
```

## sync (the sync server: the mailbox and the matchmaker in one container)

```sh
# One process, one port, one file on a volume. The app talks to it at
# https://sync.organizeyourworkplace.com and the same server serves every
# committee.
PORT=8080
HOST=0.0.0.0
DATA_DIR=/data
DB_FILE=/data/mailbox.db

# Which sites the browser may ask from. * allows any, which is safe here:
# the queue label is the capability and the server holds only ciphertext.
# Set it to the site's own domain to be strict.
ALLOWED_ORIGINS=*

# The caps the guard enforces (P8, P9).
PER_LABEL_PER_MINUTE=60
PER_IP_PER_MINUTE=120
POW_DIFFICULTY=4
MAX_PEERS=8
JOINS_PER_MINUTE=10
QUEUE_LIMIT=200

# Only if the host already runs PocketBase: the server then uses it as
# the store instead of the SQLite file. Leave both empty for the file.
# PB_BASE_URL=http://mbx:8090
# PB_TOKEN=TODO(owner)
```

## turn (TURN relay — 05-security §Servers)

```sh
# Coturn reads its own config from deploy/relay/turnserver.conf. The secret
# and the certificate paths are substituted at start time, never in the repo.
TURN_AUTH_SECRET=TODO(owner)
TURN_CERT=/etc/coturn/certs/turn.crt
TURN_KEY=/etc/coturn/certs/turn.key
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