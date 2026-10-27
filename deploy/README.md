# Infra as code (H7)

Everything needed to rebuild the stack on a fresh Coolify box. Secrets stay out
of the repo — copy `env/*.example` to real files and fill them in.

| File | What |
|---|---|
| `docker-compose.yml` | cms (PocketBase), mbx guard + PocketBase, GlitchTip, Umami + Postgres, matchmaker (`sig`), TURN relay (`turn`) |
| `docker-compose.local.yml` | Local dev: cms on 8090, mbx on 8091 |
| `pocketbase.Dockerfile` | Builds PocketBase from a pinned release binary |
| `env/*.example` | Env templates per service (G1, U0, P6 rules baked in) |
| `proxy/Caddyfile` | Reference proxy config: security headers (H4), `/s/` Umami path with IP stripping (U0c), `/e/` GlitchTip tunnel (G3), access logs off (H3) |
| `proxy/traefik-dynamic.yml` | The same rules as a Traefik dynamic config (Coolify's default proxy) |
| `matchmaker/` | The matchmaker service: memory only, proof of work, no logs |
| `mailbox/` | The mailbox guard: 31-day cap, size cap, rate limits, hourly purge |
| `sync-server/` | The sync server: the guard and the matchmaker in one container, one port, a SQLite file on a volume |
| `relay/` | coturn config for the TURN relay |

## Local development

Two instances run locally: `cms` for content on 8090 and `mbx` for the
mailbox on 8091. The quickest path uses the PocketBase already installed
with Homebrew:

```sh
# content instance
pocketbase serve --dir=pb_data/cms --http=127.0.0.1:8090
pocketbase superuser upsert agent@localhost.local devsuperuser123 --dir=pb_data/cms

# mailbox instance
pocketbase serve --dir=pb_data/mbx --http=127.0.0.1:8091
pocketbase superuser upsert agent@localhost.local devsuperuser123 --dir=pb_data/mbx
PB_URL=http://localhost:8091 node scripts/mbx-setup.mjs
```

The container path runs the same stack the production box runs:

```sh
docker compose -f deploy/docker-compose.local.yml -p oyw-local up -d cms mbx
docker exec oyw-local-mbx-1 /pb/pocketbase superuser upsert agent@localhost.local devsuperuser123
PB_URL=http://localhost:8091 node scripts/mbx-setup.mjs
```

`scripts/mbx-setup.mjs` creates the `queue` collection with the rules locked
to superusers, so the guard (`deploy/mailbox/`) is the only public door.
`node deploy/mailbox/check-live.mjs` runs the guard against the local
instance and prints what it did.

## Pinning (AGENTS.md rule 22)

Every image tag is `TODO(owner): pin` — fill in the exact version before the
first deploy and never auto-upgrade:

- PocketBase: release binaries from `ganigeorgiev.com/pocketbase/pocketbase`
  (the project left GitHub on 2026-10-26; the old repo is archived) [A37].
  The pinned asset is still on the GitHub release (checked 2026-10-27), and
  the new home answers its release paths with an HTML page. Switch the URL in
  `deploy/pocketbase.Dockerfile` when the new home serves the assets.
- GlitchTip: `glitchtip/glitchtip` on Docker Hub.
- Umami: `ghcr.io/umami-software/umami` (v3.x line, U0).
- Postgres/Redis: current stable major, pinned minor.

## The pieces

The site is a static build (Astro) served by Coolify. The committee
workspace has three server pieces: the sync server (the mailbox and the
matchmaker in one container), the content store, and the error tracker.

| Piece | What it is | Where |
|---|---|---|
| The site | A static build, served by Coolify | `npm run build` → `dist/` |
| The sync server | One container, one port, one file on a volume | `sync-server/README.md` |
| The content store | PocketBase, private, build time only | `docker-compose.yml` |
| The error tracker | GlitchTip, private | `docker-compose.yml` |

The sync server is the piece other people can host for themselves. It
carries the encrypted drive between phones and cannot read it.

## The site build and the cms

The build reads the content from the PocketBase `cms`, never from a copy in
the repo. `scripts/cms-fetch.mjs` runs before the build and pulls the pages
and the records into `.cache/cms`.

| Variable | What it does |
|---|---|
| `PB_URL` | The cms instance, for example `http://cms:8090` on the private network. |
| `PB_TOKEN` | A PocketBase token that can read the collections. A revocable impersonate token, never a password. |
| `PB_EMAIL` + `PB_PASS` | The local dev login, when there is no token. |
| `CONTENT_REQUIRED` | `1` makes the build fail when there is no cms. Set it on the box. |

The build without a cms still works, but it has no pages from the content,
so it is not a build to ship. On the box:

```sh
CONTENT_REQUIRED=1 PB_URL=http://cms:8090 PB_TOKEN=... npm run build
```

The CI on GitHub uses the `PB_URL` and `PB_TOKEN` secrets when they are set.

## The cms on PocketHost

The content lives on a PocketHost instance (`oyw.pockethost.io`). The
credentials are in `.env.local` as `POCKETBASE_API_URL` and
`POCKETBASE_API_TOKEN`.

The schema is a PocketBase migration in `pb_migrations/`. It goes up with
phio, which syncs the `pb_*` folders to the instance over SFTP:

```sh
phio login      # once, from the project folder
phio deploy     # the migrations go up, the instance restarts, it applies them
```

The data goes up with the seed, which copies every collection from one
instance to another and matches on each collection's own key, so running it
twice makes no duplicates:

```sh
SOURCE_PB_URL=http://127.0.0.1:8090 node scripts/cms-seed.mjs
```

PocketHost allows 1,000 API requests an hour per IP. The seed waits when it
is told to slow down, so the bulk collections (the 6,131 locals) take hours.

## Deployment order

1. Harden the box first (H1–H6) — see `runbook.md`.
2. `cms` and `errors` are **private**: reachable only over the VPN/tailnet (P1, G2).
3. `mbx` is public but hardened: logs off (P6), admin UI blocked at the proxy (P10), no backups (P11). The public door is `mbx_guard`, and the `queue` collection is locked to superusers, so the guard's token is the only way in. Create the collection with `PB_URL=<mbx> node scripts/mbx-setup.mjs`.
4. Umami and the GlitchTip tunnel are reached only through the site's first-party paths `/s/` and `/e/` (U2, G3).
5. After every PocketBase upgrade: re-verify `mbx` logs are off and the 31-day cap still rejects (runbook §Upgrade steps).