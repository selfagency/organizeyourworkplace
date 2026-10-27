# R3 plan — Committee Workspace app

Status: PLAN. Owner approves before implementation starts (per session workflow).
Specs: `plans/04-workspace-app.md` (product) + `plans/05-security.md` (protocol).

## What it is

Local-first, end-to-end encrypted committee workspace: wall chart, tracker,
evidence locker, invites, handoff. Servers only relay ciphertext. No accounts.

## Locked design decisions (from the specs — restated, not re-decided)

1. **Yjs** data model, one document per room; y-indexeddb persistence;
   y-webrtc peer sync with encrypted signaling. Automerge stays the named
   fallback if Yjs blocks a security requirement.
2. **Deniable edits:** room-key MAC (HMAC-SHA-256), never per-device signatures.
   No artifact proves which member wrote what (05-security §Deniable edits).
3. **Rooms:** Core / Point-person / Committee, each with its own key, per the
   permissions matrix. Room keys distributed only through the invite protocol.
4. **Invites:** one-time, device-bound links, secret after `#`,
   `history.replaceState` on open, 4-word check code, invite dead on approval.
5. **Removal:** 2-core approval + re-key + room-ID rotation; old mailbox queue
   deleted; the app states plainly that past syncs can't be retracted.
6. **Mailbox on PB `mbx`:** fixed-size padding buckets, daily-rotating
   `HMAC(roomKey,"mbox",date)` queue labels, client-set `expires_at`
   (1w/2w default/1mo), hourly purge, one-time prekeys for forward secrecy.
7. **Matchmaker:** memory-only, daily-rotating room IDs, no IPs logged,
   PoW + rate limits; 2–3 hosts with failover; optional Tor onion mode later.
8. **At rest:** AES-GCM, key derived from the member passphrase (same primitive
   as the evidence log). `navigator.storage.persist()` + iOS Home-Screen gate.
9. **Evaluate before writing:** existing open-source encrypted Yjs sync servers
   (R3.3 first task is this survey, output: a short table + pick recorded in
   `06-open-decisions.md` as an agent assumption).

## Build order (each lands with its tests)

| Step | Task | Agent-run? | Notes |
|---|---|---|---|
| R3.0 | Paper prototypes of screens 1–4 + session scripts | prep only | Humans run the 5 sessions; findings gate screens 1–4 polish |
| R3.1 | Threat-model doc + protocol whitepaper draft | yes | `docs/` — publish before launch |
| R3.2 | Local storage layer: encrypted IndexedDB, persist(), iOS gate | yes | Same AES-GCM core as evidence log |
| R3.3 | Yjs data model + sync-server survey + deniable-edit MAC | yes | Yjs in vitest (node) + jsdom storage tests |
| R3.4 | Keys & invites | yes | Crypto core + UI; check-code wordlist bundled. Core and protocol shipped; the invite screen itself lands with R3.8, which builds screens 0–11 |
| R3.5 | Rooms + permissions matrix | yes | Key-graph logic is pure and testable |
| R3.6 | Matchmaker/relay/mailbox services | code yes, deploy gated | Compose + service code in `deploy/`; needs the box + R2.G |
| R3.6b | Opt-in error reports w/ preview + canary test | yes | G6 guardrails |
| R3.7 | Removal/re-key, 2-of-3 recovery, encrypted backups | yes | Re-key = new room doc + key re-distribution |
| R3.8 | Screens 0–11 | yes after R3.0 findings | Mobile-first 360px, EN/ES, Quick Exit everywhere |
| R3.9 | Handoff export (AB CSV / Broadstripes XLSX) | yes | Needs 2-core approval flow; friendly-organizer sandbox test is human |
| R3.10 | Code delivery: signed releases, transparency log, reproducible build | yes | Pinned, Sigstore-style checksums in-repo |
| R3.11 | remoteStorage backup destination | post-R3 | Explicitly deferred |
| 🔒 R3.G1 | Independent security audit | human | Scope already in 05-security §Audit scope |
| 🔒 R3.G2 | Pilot with 3–5 committees | human | Via EWOC/partner unions |

## Invariants that gate merge (from 05-security §Invariants)

Each invariant becomes an automated test in the task that touches it; CI fails
on any regression. The audit (R3.G1) reviews the test suite as its entry point.

## Explicit non-goals

Chat (Signal), dues, authorization cards, per-device attribution, a central
record of member activity, public Nostr relays, Solidarity-Tech-style tracking.

## What the owner owes before specific steps

- Box + Coolify: R3.6 deploy (code lands regardless).
- Usability sessions: humans run them (agent ships prototypes + scripts early
  so they can be scheduled in parallel with R3.1–R3.5 code).
- Audit + pilot: human gates, after R3.10.
