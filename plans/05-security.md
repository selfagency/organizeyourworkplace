# 05 Security

**This file overrides every other plan.**

**Core rule:** a central list of who is organizing where is the most dangerous thing this site could hold. If it is breached, subpoenaed or leaked, workers get fired. So the server never holds readable worker data. This is CryptPad's model: if its code isn't modified, neither the admins nor an attacker who breaches the server can read user content [A6].

## Invariants (test each one)

| # | Invariant | How to test |
|---|---|---|
| S1 | No plaintext worker data leaves a device | Proxy all traffic; grep for seeded canary names in every request body, header and URL |
| S2 | No third-party requests | CSP `default-src 'self'`; CI crawls every page and fails on any off-origin request |
| S3 | No accounts, no email collection | Code review; no auth endpoints |
| S4 | Keys never reach a server | Secrets live only in URL fragments (`#…`), which are stripped from history on open; fragments are never logged |
| S5 | Servers keep no logs with IPs | Config review of the app, web server and host; logs off or IP-scrubbed |
| S6 | Tools never send user input | Tests mock `fetch` and assert zero calls carry input |
| S7 | Code updates are signed and user-approved | Tampered build fails signature check; app refuses it |
| S8 | Workspace edits are deniable | No workspace update carries a per-device signature. A leaked export can't be verified as written by a specific member (see §Deniable edits) |

## Build vs. integrate

| Need | Decision | Why |
|---|---|---|
| Chat | **Integrate Signal.** Write guides and group templates (usernames instead of phone numbers, disappearing messages, separate "Committee" and "Trusted contacts" groups). | Signal usernames avoid sharing phone numbers [A7]. Signal keeps no record of group membership, names or avatars. Groups support link/QR invites, admin approval, admin-only timer control, and up to 1,000 members [A17]. Building messaging is a multi-year security project. |
| Chat for 200+ person units | Matrix/Element, later | Needs 24/7 servers and accounts |
| Docs and files | Self-hosted CryptPad on `pad.` subdomain; Proton Drive as fallback | Open source, end-to-end encrypted, already built |
| Wall chart | R2: CryptPad templates. R3: local-first app. | Ship without writing crypto first |
| Authorization cards | **Don't collect them.** Give printable explainers; signing goes through the union. | E-signatures require name, contact info, phone, authorization language, date, employer, a declaration describing the technology, and a confirmation to each signer [A8]. Holding them puts identities on the server. |
| Dues | **Don't build.** | Compliance and liability |
| Crypto | WebCrypto or libsodium only | No homemade primitives |

## Threats and defenses

| Threat | Defense |
|---|---|
| A coworker reports to the boss (most common) | Technology can't fix this. Need-to-know rooms; Organize content teaches vetting through one-on-ones before sharing names. |
| Employer monitoring of work devices, email, chat, Wi-Fi | Work-device banner; "never use company Slack or email"; mobile-first |
| Lost or seized phone | App lock with a separate passcode, auto-lock, a wipe button that also clears unsent updates, disappearing messages in Signal, one-time mailbox keys (old updates unreadable) |
| Subpoena to the site | Server holds only scrambled data; short log retention, no IPs; counsel on standby; published legal-request policy |
| Site breach | No readable data; no third-party scripts/CDNs/analytics; strict CSP; independent audit before workspace launch |
| Lost workspace key | 2-of-3 recovery split among core members; site can't recover it, and says so |
| Fake "union" or poisoned directory | Directory from verified sources only; editor review; changelog |
| Tampered app code | See §Code delivery (biggest risk) |

Build security content on EFF Surveillance Self-Defense, especially its security-plan exercise.

## Web hardening (content site and app)

- Headers: `Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`, HSTS with preload, `Referrer-Policy: no-referrer`, `Permissions-Policy` denying camera/mic/geolocation (except the app's photo capture), `X-Content-Type-Options: nosniff`.
- Subresource Integrity on every script and style.
- No CDN in front of the matchmaker, relay or mailbox (CDNs keep their own logs). For the static content site, a CDN is allowed only if its logging is configured off; otherwise self-host. Owner decides (`06-open-decisions.md`).
- The corrections form posts to a queue with no IP logging and no email field required.

## Workspace architecture (R3)

**Model:** the workspace lives only on members' devices and syncs directly between them. A shared-editing library (Yjs; Automerge as an alternative) merges offline edits without conflicts [A20].

### Servers

| Server | Job | Can see | Can never see |
|---|---|---|---|
| Matchmaker | Helps devices in the same workspace find each other | A daily-rotating room ID, IPs, connection times | Names, ratings, notes, anything in the workspace |
| Relay (**on by default**) | Passes traffic so members never see each other's IPs | Scrambled traffic, size, timing | Contents, which member is which |
| Encrypted mailbox | Holds updates for offline members (night shift gets day shift's notes) | Scrambled updates padded to fixed sizes, a daily-rotating queue label, arrival times | Contents, member identities, who an update is for, how many members a room has |

**Public copy must say:** "No server holds your data. Our servers pass along scrambled messages they can't read. They can see that a device connected, and when." **Never say "no servers."**

### Matchmaker hardening

| Goal | How |
|---|---|
| Can't read or hijack | All signaling encrypted with the room key (y-webrtc does this when a room password is set [A22]). Devices authenticate with invite-derived keys, so a hacked matchmaker can't insert a fake member. Worst case: block or delay connections. |
| Holds nothing | Memory only; no disk; IP logging off in app, web server and host; no CDN; no accounts; no lasting connection IDs |
| Silent to strangers | Per-workspace secret network key. A device without it can't finish the handshake, and the server never confirms what it is (like SSB's secret handshake [A24]). |
| Can't follow a room over time | `roomId = HMAC(roomKey, UTC date)`, rotating daily; only members can compute it |
| Harder to correlate joins | Random join delays; padded signaling messages |
| Never sees real IPs (high-risk mode) | Optional Tor onion services for matchmaker, relay and mailbox |
| Survives takedown | 2–3 matchmakers on different hosts with failover; committees can self-host; last resort: in-person QR pairing with no matchmaker |
| Survives abuse | HTTPS only, per-room rate limits, proof-of-work to join, separate host from the content site, open source, auto-patching |

**Legal demands:** with no logs, a subpoena for past records gets nothing. But a court can order you to start logging. Tor mode and the relay exist for that case. Keep a lawyer, and publish a legal-request policy. Don't rely on a warrant canary; its legal standing is disputed.

### Mailbox

- Retention: ≤30 days (suggested; owner decides).
- Queue labels are `HMAC(roomKey, "mbox", date)`, rotating daily.
- Messages are padded to fixed size buckets.
- No recipient list or member count is visible to the server.
- **Forward secrecy:** each recipient device publishes one-time prekeys (Signal-style) into the encrypted room state. Mailbox messages are encrypted to one-time keys that are deleted after use, so a later device seizure can't open old queued messages.
- Never use public Nostr relays. Their recipient tag exposes who a message is for.

### Invites

Never one reusable link. Every invite is single-use and bound to one device.
1. A core member taps Invite and gets a one-time link that expires in 24h. The secret sits after the `#`, which browsers never send to servers (the CryptPad pattern [A18]).
2. Share over Signal only. The share sheet offers nothing else.
3. The new member opens it on their own phone. The app immediately calls `history.replaceState` to remove the fragment, because browser history can sync to an employer's Chrome profile. Then it generates a device key.
4. The inviter sees a join request with a **4-word check code**, which both people compare in person or on a Signal call. The inviter approves.
5. The inviter's device sends the room keys, encrypted to the new device key. The invite is now dead.

### Removal

- Removal cuts off future updates. **It can't take back what the person already synced.** Say this plainly in the app and in the content.
- It needs approval from 2 core members.
- The remaining devices generate new keys and move to a new room ID. The old room is abandoned and its mailbox queue deleted.
- The room split limits exposure to the removed person's tier.

### Device storage and iOS

- Safari deletes script-writable storage after 7 days of Safari use without visiting the site. Home Screen web apps keep their own separate counter [A21].
- **On iPhone, setup blocks until the app is added to the Home Screen.**
- Call `navigator.storage.persist()`.
- The Today screen warns when fewer than 2 devices hold a full Core copy.
- A monthly prompt saves an encrypted backup file to the member's own storage.
- **Later (after R3): optional remoteStorage backup destination** [A30][A31].
  - remoteStorage is an open protocol for personal storage that apps reach through OAuth, and remotestorage.js can also target Dropbox or Google Drive.
  - Upload only the encrypted backup file, under a neutral filename. Show a "never use a work account" warning.
  - Tell the user that the provider still sees that the file exists, its size and when it changes.
  - Strip the OAuth token from the URL fragment immediately (same pattern as invites).
- Lost key → 2-of-3 recovery.

### Building blocks and limits

- **Sync:** Yjs + y-indexeddb; y-webrtc for direct sync with an encrypted signaling password [A22].
- **Size limit:** y-webrtc is a full mesh and its docs say it isn't suited to many collaborators. That's fine for 5–20 people. Larger committees sync via relay + mailbox.
- **Evaluate existing open-source encrypted Yjs sync servers before writing a custom layer.**
- **Crypto:** WebCrypto / libsodium. Data at rest uses AES-GCM with a key derived from the passphrase.

### Deniable edits

**Don't sign workspace edits with per-device keys.** A signed edit lets a member who flips hand the boss a file that *proves* Maria wrote "Dev is a 5."

- **Device authentication happens at connect time,** with the invite-derived keys: who is allowed in.
- **Edit integrity uses a MAC with the shared room key**, e.g. AES-GCM or HMAC over each Yjs update. Any member could have produced it, so a leaked copy proves nothing about authorship.
- **Author attribution inside the app** (the "by" field on conversations) is ordinary data. It is useful to members and not cryptographic proof.
- **Precedent:** atproto spaces drop signatures for the same reason. Permissioned data "should not carry proof of authorship that survives a leak outside its access boundary" [A32].
- **Exception: the retaliation evidence log keeps signatures and a hash chain.** There, the worker *wants* proof that entries weren't backdated or edited.

## Code delivery (biggest risk)

Whoever serves the app's code can break all the encryption. A tampered build could copy every member's keys. If the content site is hacked or legally compelled, this is the attack.

- The installed Home Screen app keeps a known-good copy and **updates only when a member taps Update**, showing the version and release notes.
- App code is served from its own subdomain, separate from the content site, with strict CSP and SRI on every file.
- Every release is signed by the maintainers, and its fingerprint is published in an append-only transparency log. The app verifies the signature before installing.
- **Reproducible builds:** anyone can rebuild from public source and match the release byte for byte.
- Longer term: app-store wrappers (iOS/Android) for signed updates.

## Lessons from other protocols (don't adopt any)

Both hide content but leak who talks to whom. A union-buster already knows the workforce and only needs that.

| | bitchat [A25] | Scuttlebutt [A24] |
|---|---|---|
| Identity on the network | Short ID from a never-rotating key, broadcast over the air with your nickname | Permanent key pair; LAN broadcasts the public key every second |
| Connections | Announcements list up to 10 nearby devices, unencrypted | Follows are public, so anyone can draw the social graph |
| Private messages | No forward secrecy for courier/Nostr messages; the Nostr tag names the recipient | Sender, time and size are public; max 7 recipients; private-groups spec says "not fit for use in safety critical situations," unaudited, no forward secrecy [A26] |
| Delete | Local panic wipe | Impossible (append-only) |
| Runs in a browser | No | No |
| Health | Active, has a whitepaper | Mostly dormant [A27]; successor PZP "not ready for end users" [A28] |

**Borrowed (already in the specs above):**
- daily-rotating labels for room IDs and mailbox queues;
- a per-workspace network key with a silent handshake;
- hidden recipient lists;
- Restricted invite mode for Core;
- signed, hash-chained evidence entries;
- a wipe that clears queued data;
- a published whitepaper with an honest security section.

**Do better than both:**
- real deletion via re-keying;
- membership never posted anywhere;
- one-time mailbox keys;
- relay on by default;
- no public Nostr relays.

**Later, maybe (not R1–R3):** a native Bluetooth mode for no-signal workplaces and pickets. It would need rotating on-air IDs and a warning that nearby phones remain detectable. tinySSB shows the idea works over LoRa [A29].

### Storage protocols checked (don't use for workspace data)

In all three, the storage server can read data unless the app encrypts it, and each person carries a lasting identity that links them to the drive.

| Protocol | Finding | Borrowed |
|---|---|---|
| **Atproto spaces** (PDSes) | "Access control, not confidentiality"; not end-to-end encrypted. Each member's PDS stores their records under an address naming the space, and the space host issues access per user DID, so servers can infer membership. Alpha: "has not undergone careful security review. Do not upload sensitive information." [A32][A33] | Deniable edits (§Deniable edits); short-lived access credentials (10 min default) |
| **Solid pods** | No built-in encryption; the pod provider can read data. Access lists live on the server; WebIDs are lasting URLs [A34] | Nothing |
| **remoteStorage** | Per-user storage via OAuth scopes; no shared-space model; server sees what it's sent [A30] | Optional encrypted backup destination (§Device storage and iOS) |

**Revisit atproto only if** spaces ship audited end-to-end encryption that also hides which PDSes hold a space's data. Even then, every member would need an atproto account linked to the drive.

## Audit scope (R3 gate)

The independent audit must cover:
- invites;
- removal and re-keying;
- fragment stripping;
- mailbox metadata and the one-time-key scheme;
- backup files;
- the 2-of-3 recovery;
- matchmaker, relay and mailbox servers;
- code delivery (signing, transparency log, reproducible build);
- the evidence-log hash chain;
- deniable edits (no per-device signatures on workspace updates).
