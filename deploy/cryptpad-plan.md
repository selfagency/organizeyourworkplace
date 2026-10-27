# CryptPad deployment plan (R2.1)

**Status: PLAN ONLY. Do not deploy without the owner's go (06-open-decisions.md #2).**

## What it is

Self-hosted CryptPad on subdomain `pad.organizeyourworkplace.com`, giving committees
shared wall charts, trackers and notes before the R3 workspace app exists. CryptPad
encrypts client-side; the server holds only ciphertext (same principle as our mailbox).

## Source and pinning

- Upstream: `cryptpad/cryptpad` (GitHub).
- **Pin a version** before deploy (AGENTS.md rule 22). Record it here and in the
  compose file. Never auto-upgrade.
- Official Docker image or compose from the repo — verify the image digest and pin it.

## Subdomain and TLS

- `pad.` A/AAAA record → Coolify box, behind the same proxy that terminates TLS
  for the other subdomains (see `proxy/`).
- HSTS on; headers H4 applied; no analytics, no error reporting on `pad.`.
- Rate-limit signups: CryptPad admin → registrations **invite-only** after the
  committee accounts exist.

## Hardening checklist

- [ ] Fresh VM/user for the pad service (no shared credentials with the CMS box).
- [ ] UFW: only proxy/HTTP(S) + SSH (keys only) reachable.
- [ ] `install/config.js`: `httpUnsafeOrigin` set to the `pad.` origin;
      `httpSafeOrigin` per docs; admin account created from the setup URL and the
      setup page **removed** (CryptPad flags this after first login).
- [ ] Registration closed (`restrictRegistration: true`) once accounts exist.
- [ ] Disk quota per account set small — this is a document tool, not a file host.
- [ ] Logs: off or local-only, short retention; nothing beyond IPs (which we
      strip at the proxy anyway, per decision #6 once taken).
- [ ] Backups: encrypted nightly export of CryptPad's `datastore` + `blobs` to the
      same backup target as the CMS; **restore tested once before go-live.**
- [ ] Update drill: pinned upgrade path documented (snapshot → upgrade → verify
      open/create pad → rollback point kept).

## Backup policy

- Nightly `datastore/` + `config/` snapshot, encrypted at rest (age/ssh key held
  by the owner, never in the repo).
- Retention: 14 daily + 4 weekly. Committee data is the workers' data — the
  backup exists so *they* don't lose it, not so we can read it; backups stay
  encrypted and access stays with the owner only.

## Owner gates

- Decision #2 (CryptPad go) in `06-open-decisions.md`.
- R2.G server-hardening review before any committee data lands.
