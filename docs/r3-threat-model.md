# R3.1 — Committee Workspace threat model (DRAFT for R3.G1 audit)

Status: draft whitepaper. Sources: `plans/05-security.md` (protocol decisions),
`plans/04-workspace-app.md` (product). No protocol changes made here — this
restates the spec as an auditable model.

## 1. Assets (what an attacker wants)

- The **wall chart**: names, departments, shifts, ratings, notes — the map of
  who supports the union. Exposure = firing targets, ULP-fight sabotage.
- **Conversations and evidence**: incident accounts, photos, pay stubs.
- **The member list itself**: being *known* as a member can cost a worker
  their job even without a chart.
- **Invites**: a live one-time link or room key = entry as a fake member.

## 2. Adversaries

| Adversary | Capability | Primary defense |
|---|---|---|
| Employer / HR | Work devices, work Wi-Fi, DNS logs, MDM, browser-profile sync, social pressure on a member | Setup blocks work devices (banner + tool rule); invites scrubbed via `history.replaceState`; notes guidance; Signal for chat |
| Network observer | Sees traffic to our servers, timing, sizes | Relay by default; padded fixed-size mailbox messages; Tor onion mode optional |
| Matchmaker operator (us or seized) | Connection metadata, room IDs seen | Memory-only, no disk, daily-rotating `HMAC(roomKey, date)` IDs, secret handshake; worst case = block/delay, never read or inject |
| Mailbox operator | Queued ciphertext | Contents encrypted to one-time prekeys (forward secrecy); daily-rotating queue labels; retention 1w/2w/1mo; no recipient visibility |
| Law enforcement | Subpoena for records | No logs to hand over; legal-request policy; Tor mode + relay for start-logging orders; no warrant canary (disputed standing) |
| Malicious/turned member | Real access to their tier | Rooms are tiers (Core/Point person/Committee); removal = 2-core re-key + room-ID rotation; **past syncs can't be retracted — stated in app and content** |
| Stolen device | Full local store | Passphrase-derived AES-GCM at rest; auto-lock; panic wipe; 7-day Safari eviction mitigated by Home-Screen gate + `storage.persist()`; 2-of-3 recovery |
| Fabricator of history | Forges "who wrote what" | **Deniable edits**: room-key MAC only, no per-device signatures — nothing cryptographic ties an edit to a member |

## 3. Protocol summary

- **Sync:** Yjs document per room; y-webrtc with encrypted signaling (room
  password); Automerge fallback only if Yjs blocks a requirement.
- **Keys:** workspace root key from invite; per-room keys; device keys at join.
  Invites are single-use, device-bound, 24h expiry, secret in URL fragment,
  4-word check code compared live, dead on approval.
  The invite secret is a 32-byte bearer capability: it authenticates the join
  request with an HMAC, so a requester who never held the link is refused
  before any key moves. Device keys are ECDH P-256 pairs generated
  non-extractable, so the room key reaches one device without a server in the
  middle. The check code is 32 bits taken from a 256-entry wordlist; the
  display puts the index next to the word, because the index is what a pair
  reading in different languages can compare.
- **At rest:** AES-GCM envelope keyed by member passphrase (PBKDF2-SHA256
  600k) — same primitive as the evidence log.
- **Attribution:** none cryptographic. Edits MAC'd with the room key.
- **Servers:** matchmaker (memory), relay (on by default), mailbox (PB `mbx`,
  P6–P11). Public copy says "servers pass scrambled messages they can't read" —
  never "no servers."

## 4. Residual risks (accepted, stated)

- A member can screenshot or copy anything their tier shows them. No crypto
  fixes people; inoculation and tiering manage it.
- Removal can't un-sync history the removed member already holds.
- A compromised device with an unlocked session is game over for that device's
  copy — auto-lock and panic wipe shorten, not eliminate, that window.
- Safari storage eviction is mitigated, not solved, outside Home-Screen install.

## 5. Audit handoff (R3.G1 scope per 05-security)

Invite protocol implementation · key distribution and rotation (re-key) ·
mailbox crypto (prekeys, padding, labels) · matchmaker hardening claims vs code
· at-rest envelopes · the invariant test suite (each 05-security §Invariants
item is a CI test).

Open items: sync-server survey pick (R3.3) recorded before audit; usability
findings may move screens but not protocol.
