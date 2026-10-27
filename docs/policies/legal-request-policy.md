# Legal-request policy — DRAFT for owner + lawyer review

**Status: draft. Not published. Depends on decision #6 (IP stripping) and the
final analytics/error config; re-check every claim against the live deployment
before this ships (same rule as the privacy page).**

## Purpose

A short, public statement of what happens when this site receives a legal demand
(subpoena, court order, takedown, DMCA, government request). It protects workers
by stating plainly what we cannot produce — because we do not have it.

## What we hold (as deployed; keep in sync with /about/privacy)

- **Content-site analytics:** aggregate page counts only. No IPs (decision #6),
  no query strings, no tool content. ~30-day retention.
- **Error reports (GlitchTip):** technical errors only, 14 days, no tool or
  workspace content, no worker identifiers, sent only on explicit tap.
- **PocketBase `cms`:** content records (pages, union directory). Public data.
- **PocketBase `mbx`:** encrypted blobs for the committee mailbox. Ciphertext
  only; keys live on members' devices.
- **CryptPad (`pad.`):** client-encrypted documents. We hold ciphertext.
- **Nothing else.** No accounts, no email lists, no tool submissions — the
  private tools never transmit worker input anywhere.

## What we cannot produce

- The identity, workplace, answers, ratings, notes, or evidence of any worker
  using the private tools or the workspace. **We never had it.**
- Plaintext of any mbx or pad content. Keys are not on our servers.
- Per-user browsing histories. The analytics cannot answer who did what.

## Process for any demand

1. Route to the owner. No one else responds.
2. Owner forwards to the site's lawyer (worker-side counsel on call).
3. We produce only what the order lawfully compels, from the categories above,
   and we say on the record what categories do not exist.
4. If the demand is not lawfully compelling (e.g. informal request, fishing
   expedition), we decline and document the decline.
5. **Notification:** if permitted, we notify affected users via the site
   (changelog entry) that a demand was received. If gagged, we note the gag's
   existence and scope as soon as it lapses.

## Takedown requests

Content is factual and sourced; corrections go through /about/corrections.
We do not remove sourced factual claims under pressure, but we fix any factual
error found — the correction policy doubles as the takedown response.

## Open items (owner/lawyer)

- `TODO(owner+lawyer)`: confirm the notification commitment is compatible with
  the gag orders we're likely to see.
- `TODO(owner+lawyer)`: choose jurisdiction-specific language for "lawfully
  compelled" (state + federal).
- `TODO(owner)`: name the on-call lawyer before publishing.
