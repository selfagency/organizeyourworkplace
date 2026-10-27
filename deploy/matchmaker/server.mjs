/**
 * R3.6 matchmaker (05-security §Matchmaker hardening).
 *
 * The matchmaker helps devices in the same workspace find each other. It
 * holds nothing on disk, keeps no logs, never writes an IP anywhere, and
 * cannot read what it carries: every blob it relays is already encrypted
 * with the room key.
 *
 * Abuse resistance lives here because it is the part a stranger can touch:
 * a proof of work to join, a cap on peers per room, and a join rate limit.
 * The room id rotates daily and is computed by the members, so the server
 * cannot follow a room over time.
 *
 * Signaling is plain HTTP with a pull loop. The committee app talks to its
 * own client, and an HTTP loop is dependency free and testable end to end.
 * If latency ever demands it, the transport can be swapped for a websocket
 * without touching the rules in this file.
 */
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const ROOM_ID = /^[A-Za-z0-9_-]{16,64}$/;
const PEER_ID = /^[A-Za-z0-9_-]{8,64}$/;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export const DEFAULT_POW_DIFFICULTY = 4;
export const DEFAULT_MAX_PEERS = 8;
export const DEFAULT_JOINS_PER_MINUTE = 10;
export const DEFAULT_QUEUE_LIMIT = 200;
/** A signed pull loop is one pull every two seconds. */
export const PULLS_PER_MINUTE = 30;

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function solvePow(challenge, difficulty) {
  for (let counter = 0; counter < Number.MAX_SAFE_INTEGER; counter++) {
    if (sha256Hex(`${challenge}:${counter}`).startsWith('0'.repeat(difficulty))) {
      return counter;
    }
  }
  throw new Error('no solution found');
}

export function verifyPow(challenge, counter, difficulty) {
  if (!Number.isSafeInteger(counter) || counter < 0) return false;
  return sha256Hex(`${challenge}:${counter}`).startsWith('0'.repeat(difficulty));
}

export function createMatchmaker(options = {}) {
  const powDifficulty = options.powDifficulty ?? DEFAULT_POW_DIFFICULTY;
  const maxPeers = options.maxPeers ?? DEFAULT_MAX_PEERS;
  const joinsPerMinute = options.joinsPerMinute ?? DEFAULT_JOINS_PER_MINUTE;
  const queueLimit = options.queueLimit ?? DEFAULT_QUEUE_LIMIT;
  const now = options.now ?? (() => Date.now());

  /** room id -> { peers: Map<peerId, {joinedAt, handshake}>, queue: [], seq } */
  const rooms = new Map();
  /** challenge -> { room, issuedAt } */
  const challenges = new Map();
  /** ip -> join timestamps. In memory only, never logged, pruned every minute. */
  const joinsByIp = new Map();
  /** peerId -> pull timestamps, same regime as the joins. */
  const pullsByPeer = new Map();

  const prune = () => {
    const cutoff = now() - CHALLENGE_TTL_MS;
    for (const [challenge, entry] of challenges) {
      if (entry.issuedAt < cutoff) challenges.delete(challenge);
    }
    const minute = now() - 60_000;
    for (const [ip, stamps] of joinsByIp) {
      const kept = stamps.filter((stamp) => stamp > minute);
      if (kept.length === 0) joinsByIp.delete(ip);
      else joinsByIp.set(ip, kept);
    }
    for (const [peer, stamps] of pullsByPeer) {
      const kept = stamps.filter((stamp) => stamp > minute);
      if (kept.length === 0) pullsByPeer.delete(peer);
      else pullsByPeer.set(peer, kept);
    }
  };

  const room = (roomId) => {
    let entry = rooms.get(roomId);
    if (!entry) {
      entry = { peers: new Map(), queue: [], seq: 0 };
      rooms.set(roomId, entry);
    }
    return entry;
  };

  return {
    challenge(roomId) {
      if (!ROOM_ID.test(roomId)) return { ok: false, reason: 'bad-room' };
      prune();
      const challenge = randomBytes(16).toString('hex');
      challenges.set(challenge, { room: roomId, issuedAt: now() });
      return { ok: true, challenge, difficulty: powDifficulty };
    },

    join({ roomId, peerId, challenge, counter, handshake, ip }) {
      if (!ROOM_ID.test(roomId)) return { ok: false, reason: 'bad-room' };
      if (!PEER_ID.test(peerId)) return { ok: false, reason: 'bad-peer' };
      prune();
      const issued = challenges.get(challenge);
      if (!issued || issued.room !== roomId) return { ok: false, reason: 'bad-challenge' };
      challenges.delete(challenge);
      if (!verifyPow(challenge, counter, powDifficulty)) return { ok: false, reason: 'bad-pow' };

      const stamps = (joinsByIp.get(ip) ?? []).filter((stamp) => stamp > now() - 60_000);
      if (stamps.length >= joinsPerMinute) return { ok: false, reason: 'rate-limited' };
      stamps.push(now());
      joinsByIp.set(ip, stamps);

      const entry = room(roomId);
      if (entry.peers.has(peerId)) {
        // A peer that is already here cannot silently take its old seat
        // again: leave first, or use a new peer id.
        return { ok: false, reason: 'already-joined' };
      }
      if (entry.peers.size >= maxPeers) {
        return { ok: false, reason: 'room-full' };
      }
      const existing = [...entry.peers.entries()].map(([id, peer]) => ({ peerId: id, handshake: peer.handshake }));
      entry.peers.set(peerId, { joinedAt: now(), handshake: handshake ?? null });
      for (const peer of existing) {
        entry.queue.push({ seq: ++entry.seq, peerId: peer.peerId, kind: 'handshake', blob: peer.handshake });
      }
      entry.queue.push({ seq: ++entry.seq, peerId, kind: 'joined', blob: null });
      return { ok: true, seq: entry.seq, peers: existing.map((peer) => peer.peerId) };
    },

    message({ roomId, peerId, blob }) {
      if (!ROOM_ID.test(roomId) || !PEER_ID.test(peerId)) return { ok: false, reason: 'bad-request' };
      if (typeof blob !== 'string' || blob.length === 0) return { ok: false, reason: 'bad-blob' };
      const entry = rooms.get(roomId);
      if (!entry || !entry.peers.has(peerId)) return { ok: false, reason: 'not-joined' };
      if (entry.queue.length >= queueLimit) return { ok: false, reason: 'queue-full' };
      entry.queue.push({ seq: ++entry.seq, peerId, kind: 'message', blob });
      return { ok: true, seq: entry.seq };
    },

    pull({ roomId, peerId, since }) {
      const entry = rooms.get(roomId);
      if (!entry || !entry.peers.has(peerId)) return { ok: false, reason: 'not-joined' };
      // A pull costs a stamp, the same as the mailbox reads: one peer
      // hammering the queue cannot sit out the limit.
      const stamps = pullsByPeer.get(peerId) ?? [];
      if (stamps.length >= PULLS_PER_MINUTE) return { ok: false, reason: 'rate-limited' };
      stamps.push(now());
      pullsByPeer.set(peerId, stamps);
      const from = Number.isSafeInteger(since) && since >= 0 ? since : 0;
      const blobs = entry.queue.filter((item) => item.seq > from);
      return { ok: true, seq: entry.seq, blobs };
    },

    leave({ roomId, peerId }) {
      const entry = rooms.get(roomId);
      if (!entry) return { ok: false, reason: 'no-room' };
      entry.peers.delete(peerId);
      if (entry.peers.size === 0) rooms.delete(roomId);
      return { ok: true };
    },

    stats() {
      return { rooms: rooms.size, peers: [...rooms.values()].reduce((sum, entry) => sum + entry.peers.size, 0) };
    },
  };
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) reject(new Error('too large'));
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('bad json'));
      }
    });
    request.on('error', reject);
  });
}

function send(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  });
  response.end(body);
}

export function createMatchmakerHandler(matchmaker) {
  return async (request, response) => {
    const url = new URL(request.url, 'https://sig.invalid');
    const ip = request.socket.remoteAddress ?? 'unknown';
    try {
      if (request.method === 'POST' && url.pathname === '/challenge') {
        const body = await readJson(request);
        send(response, 200, matchmaker.challenge(String(body.room ?? '')));
        return;
      }
      if (request.method === 'POST' && url.pathname === '/join') {
        const body = await readJson(request);
        send(
          response,
          200,
          matchmaker.join({
            roomId: String(body.room ?? ''),
            peerId: String(body.peer ?? ''),
            challenge: String(body.challenge ?? ''),
            counter: body.counter,
            handshake: body.handshake ?? null,
            ip,
          }),
        );
        return;
      }
      if (request.method === 'POST' && url.pathname === '/message') {
        const body = await readJson(request);
        send(
          response,
          200,
          matchmaker.message({
            roomId: String(body.room ?? ''),
            peerId: String(body.peer ?? ''),
            blob: body.blob,
          }),
        );
        return;
      }
      if (request.method === 'POST' && url.pathname === '/leave') {
        const body = await readJson(request);
        send(
          response,
          200,
          matchmaker.leave({ roomId: String(body.room ?? ''), peerId: String(body.peer ?? '') }),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/pull') {
        const since = Number(url.searchParams.get('since') ?? '0');
        send(
          response,
          200,
          matchmaker.pull({
            roomId: url.searchParams.get('room') ?? '',
            peerId: url.searchParams.get('peer') ?? '',
            since,
          }),
        );
        return;
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        send(response, 200, { ok: true });
        return;
      }
      send(response, 404, { ok: false, reason: 'not-found' });
    } catch {
      send(response, 400, { ok: false, reason: 'bad-request' });
    }
  };
}

export function createMatchmakerServer(matchmaker) {
  return createServer(createMatchmakerHandler(matchmaker));
}
