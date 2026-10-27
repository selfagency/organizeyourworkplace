import { describe, expect, it, vi } from 'vitest';

import { createMatchmaker, createMatchmakerServer, solvePow, verifyPow } from './server.mjs';

const ROOM = 'room-room-room-0001';
const PEER = 'peer-0001';

function matchmakerWith(overrides = {}) {
  let clock = Date.UTC(2026, 9, 27, 12, 0, 0);
  const matchmaker = createMatchmaker({
    powDifficulty: 2,
    maxPeers: 2,
    joinsPerMinute: 2,
    now: () => clock,
    ...overrides,
  });
  return { matchmaker, tick: (ms) => { clock += ms; } };
}

function joinOk(matchmaker, peerId, ip = '10.0.0.1') {
  const challenge = matchmaker.challenge(ROOM);
  const counter = solvePow(challenge.challenge, challenge.difficulty);
  return matchmaker.join({ roomId: ROOM, peerId, challenge: challenge.challenge, counter, ip });
}

describe('R3.6 matchmaker proof of work', () => {
  it('accepts a solution and refuses a wrong one', () => {
    const challenge = 'abc123';
    const counter = solvePow(challenge, 2);
    expect(verifyPow(challenge, counter, 2)).toBe(true);
    expect(verifyPow(challenge, counter + 1, 2)).toBe(false);
    expect(verifyPow(challenge, -1, 2)).toBe(false);
  });
});

describe('R3.6 matchmaker rooms', () => {
  it('refuses a join without a solved challenge', () => {
    const { matchmaker } = matchmakerWith();
    const challenge = matchmaker.challenge(ROOM);
    const result = matchmaker.join({
      roomId: ROOM,
      peerId: PEER,
      challenge: challenge.challenge,
      counter: solvePow('some-other-string', challenge.difficulty),
      ip: '10.0.0.1',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('bad-pow');
  });

  it('refuses a challenge that was issued for another room', () => {
    const { matchmaker } = matchmakerWith();
    const challenge = matchmaker.challenge('other-room-000001');
    const result = matchmaker.join({
      roomId: ROOM,
      peerId: PEER,
      challenge: challenge.challenge,
      counter: solvePow(challenge.challenge, challenge.difficulty),
      ip: '10.0.0.1',
    });
    expect(result.reason).toBe('bad-challenge');
  });

  it('uses a challenge once', () => {
    const { matchmaker } = matchmakerWith();
    const challenge = matchmaker.challenge(ROOM);
    const counter = solvePow(challenge.challenge, challenge.difficulty);
    const first = matchmaker.join({ roomId: ROOM, peerId: PEER, challenge: challenge.challenge, counter, ip: '10.0.0.1' });
    const second = matchmaker.join({ roomId: ROOM, peerId: 'peer-0002', challenge: challenge.challenge, counter, ip: '10.0.0.1' });
    expect(first.ok).toBe(true);
    expect(second.reason).toBe('bad-challenge');
  });

  it('lets the members of a room find each other', () => {
    const { matchmaker } = matchmakerWith();
    joinOk(matchmaker, PEER);
    const second = joinOk(matchmaker, 'peer-0002');
    expect(second.ok).toBe(true);
    expect(second.peers).toEqual([PEER]);
  });

  it('caps the room size', () => {
    const { matchmaker } = matchmakerWith({ joinsPerMinute: 10 });
    joinOk(matchmaker, PEER);
    joinOk(matchmaker, 'peer-0002');
    const third = joinOk(matchmaker, 'peer-0003');
    expect(third.ok).toBe(false);
    expect(third.reason).toBe('room-full');
  });

  it('rate limits joins from one address', () => {
    const { matchmaker } = matchmakerWith({ joinsPerMinute: 2, maxPeers: 10 });
    joinOk(matchmaker, PEER);
    joinOk(matchmaker, 'peer-0002');
    const third = joinOk(matchmaker, 'peer-0003');
    expect(third.reason).toBe('rate-limited');
  });

  it('lets the limit go after a minute', () => {
    const { matchmaker, tick } = matchmakerWith({ joinsPerMinute: 1, maxPeers: 10 });
    joinOk(matchmaker, PEER);
    expect(joinOk(matchmaker, 'peer-0002').reason).toBe('rate-limited');
    tick(61_000);
    expect(joinOk(matchmaker, 'peer-0002').ok).toBe(true);
  });

  it('carries a message only to the room it belongs to', () => {
    const { matchmaker } = matchmakerWith();
    joinOk(matchmaker, PEER);
    expect(matchmaker.message({ roomId: ROOM, peerId: PEER, blob: 'opaque' }).ok).toBe(true);
    const pulled = matchmaker.pull({ roomId: ROOM, peerId: PEER, since: 0 });
    const message = pulled.blobs.find((item) => item.kind === 'message');
    expect(message.blob).toBe('opaque');
  });

  it('refuses a message from a peer that never joined', () => {
    const { matchmaker } = matchmakerWith();
    expect(matchmaker.message({ roomId: ROOM, peerId: 'stranger', blob: 'opaque' }).reason).toBe('not-joined');
  });

  it('refuses to pull a room the peer is not in', () => {
    const { matchmaker } = matchmakerWith();
    joinOk(matchmaker, PEER);
    expect(matchmaker.pull({ roomId: ROOM, peerId: 'stranger', since: 0 }).reason).toBe('not-joined');
  });

  it('drops the room when the last peer leaves', () => {
    const { matchmaker } = matchmakerWith();
    joinOk(matchmaker, PEER);
    matchmaker.leave({ roomId: ROOM, peerId: PEER });
    expect(matchmaker.stats().rooms).toBe(0);
  });

  it('refuses a room id that is not a room id', () => {
    const { matchmaker } = matchmakerWith();
    expect(matchmaker.challenge('nope').reason).toBe('bad-room');
  });
});

describe('R3.6 matchmaker over HTTP', () => {
  it('serves a join and a pull without writing a log line', async () => {
    const { matchmaker } = matchmakerWith();
    const server = createMatchmakerServer(matchmaker);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const challenge = await fetch(`http://127.0.0.1:${port}/challenge`, {
        method: 'POST',
        body: JSON.stringify({ room: ROOM }),
      }).then((response) => response.json());
      const counter = solvePow(challenge.challenge, challenge.difficulty);
      const joined = await fetch(`http://127.0.0.1:${port}/join`, {
        method: 'POST',
        body: JSON.stringify({ room: ROOM, peer: PEER, challenge: challenge.challenge, counter }),
      }).then((response) => response.json());
      expect(joined.ok).toBe(true);
      const pulled = await fetch(`http://127.0.0.1:${port}/pull?room=${ROOM}&peer=${PEER}&since=0`).then((r) => r.json());
      expect(pulled.ok).toBe(true);
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      error.mockRestore();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
