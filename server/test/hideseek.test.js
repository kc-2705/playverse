process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const { describe, test, before, after } = require('node:test');
const { expect } = require('expect');
const request = require('supertest');
const { io: connect } = require('socket.io-client');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createServer } = require('../src/server');
const { Room } = require('../src/hideseek');
const { User, Score } = require('../src/models');

// Short phases so a whole match runs in a couple of seconds.
const TIMES = { hideMs: 300, seekMs: 6500, resultsMs: 200, rejoinMs: 5000, missFreezeMs: 200, missPenaltyMs: 400 };

let srv;
let url;
let mongo;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  srv = createServer({ hideSeekTimes: TIMES });
  await new Promise((r) => srv.server.listen(0, r));
  url = `http://localhost:${srv.server.address().port}`;
});
after(async () => {
  srv.io.close();
  await new Promise((r) => srv.server.close(r));
  await mongoose.disconnect();
  await mongo.stop();
});

/** A test player: a socket plus the latest room snapshot and events it received. */
function player() {
  const socket = connect(url, { transports: ['websocket'], forceNew: true });
  const p = { socket, room: null, events: [] };
  socket.on('room', (r) => (p.room = r));
  socket.on('event', (e) => p.events.push(e));
  p.call = (event, msg) => new Promise((resolve) => socket.emit(event, msg, resolve));
  p.until = async (check, ms = 9000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (check(p)) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('Timed out waiting for the room to change');
  };
  return p;
}

describe('hide and seek', () => {
  test('two players play a full match: hide, a miss, a find, a time-out, final scores', async () => {
    const a = player();
    const b = player();
    const created = await a.call('join', { create: true, name: 'Ann' });
    expect(created.ok).toBe(true);
    expect(created.code).toMatch(/^[A-Z0-9]{4}$/);
    const joined = await b.call('join', { code: created.code.toLowerCase(), name: 'Ben' });
    expect(joined.ok).toBe(true);
    await a.until((p) => p.room?.players.length === 2);

    // Only the host can start.
    expect((await b.call('start')).ok).toBe(false);
    expect((await a.call('start')).ok).toBe(true);
    await a.until((p) => p.room.phase === 'hide');

    const ids = { [created.playerId]: a, [joined.playerId]: b };
    const hider = ids[a.room.hiderId];
    const seeker = hider === a ? b : a;
    const me = (p) => p.room.players.find((x) => x.id === (p === a ? created.playerId : joined.playerId));

    // Seekers can't move while the hider hides.
    const seekerStart = { ...me(seeker) };
    seeker.socket.emit('move', { x: seekerStart.x + 1, z: seekerStart.z, yaw: 0 });
    // The hider walks a little and picks a disguise.
    const h = me(hider);
    hider.socket.emit('move', { x: h.x + 0.5, z: h.z, yaw: 1, moving: true, disguise: 'plant' });
    await hider.until((p) => me(p).disguise === 'plant');

    await seeker.until((p) => p.room.phase === 'seek');
    // A far-away tag is refused; a wrong nearby tag is a miss that freezes the seeker and costs time.
    expect((await seeker.call('tag', { x: 25, z: 17 })).reason).toBe('Too far away.');
    const before = seeker.room.endsAt;
    const miss = await seeker.call('tag', { x: me(seeker).x + 1, z: me(seeker).z });
    expect(miss).toEqual({ ok: true, found: false });
    await seeker.until((p) => p.room.endsAt <= before - 300);
    expect(seeker.events.some((e) => e.type === 'miss')).toBe(true);

    // Teleporting across the map is ignored; the server keeps the old position.
    seeker.socket.emit('move', { x: 40, z: 10, yaw: 0 });
    // Round 1 ends by time-out: the hider earns 150.
    await seeker.until((p) => p.events.some((e) => e.type === 'timeup'));
    expect(seeker.room.players.find((x) => x.id === a.room.hiderId)).toBeTruthy();

    // Round 2: roles swap. Walk the new seeker next to the new hider and tag them.
    await a.until((p) => p.room.phase === 'hide' && p.room.round === 2);
    const hider2 = ids[a.room.hiderId];
    const seeker2 = hider2 === a ? b : a;
    expect(hider2).toBe(seeker);
    await seeker2.until((p) => p.room.phase === 'seek');
    const target = me(hider2);
    // Step toward the hider in small, believable moves.
    let pos = { ...me(seeker2) };
    for (let i = 0; i < 400 && Math.hypot(pos.x - target.x, pos.z - target.z) > 2; i++) {
      const d = Math.hypot(target.x - pos.x, target.z - pos.z);
      pos = { x: pos.x + ((target.x - pos.x) / d) * 0.35, z: pos.z + ((target.z - pos.z) / d) * 0.35 };
      seeker2.socket.emit('move', { ...pos, yaw: 0, moving: true });
      await new Promise((r) => setTimeout(r, 40));
    }
    const hit = await seeker2.call('tag', { x: target.x, z: target.z });
    expect(hit).toEqual({ ok: true, found: true });

    await a.until((p) => p.room.phase === 'final');
    const scores = Object.fromEntries(a.room.players.map((p) => [p.name, p.score]));
    // Round-1 hider survived (+150) and then found the other player in round 2 (+100 or more).
    expect(scores[seeker2 === a ? 'Ann' : 'Ben']).toBeGreaterThanOrEqual(250);
    // The other player only earned a little for the seconds they stayed hidden.
    expect(scores[hider2 === a ? 'Ann' : 'Ben']).toBeLessThan(100);
    a.socket.close();
    b.socket.close();
  });

  test('a dropped player can rejoin with their id and keep their place', async () => {
    const a = player();
    const created = await a.call('join', { create: true, name: 'Cara' });
    a.socket.close();
    const again = player();
    const back = await again.call('join', { code: created.code, playerId: created.playerId });
    expect(back.ok).toBe(true);
    expect(back.playerId).toBe(created.playerId);
    await again.until((p) => p.room?.players.length === 1 && p.room.hostId === created.playerId);
    again.socket.close();
  });

  test('at the end of a match the server saves scores for logged-in players only', async () => {
    const user = await User.create({ username: 'Saver', usernameKey: 'saver', email: 's@x.dev', passwordHash: 'x' });
    const room = new Room('TEST', TIMES, () => {});
    const member = room.addPlayer({ name: 'Saver', userId: user._id.toString() });
    const guest = room.addPlayer({ name: 'Guest' });
    member.score = 240;
    guest.score = 90;
    room.matchStarted = Date.now() - 60_000;
    await room.finish();
    const saved = await Score.find({ game: 'museum-hide-seek' }).lean();
    expect(saved).toHaveLength(1);
    expect(saved[0].score).toBe(240);
    expect(String(saved[0].user)).toBe(user._id.toString());
    room.dispose();
  });

  test('bad codes are refused and clients cannot post hide and seek scores', async () => {
    const a = player();
    expect(await a.call('join', { code: 'NOPE' })).toEqual({ ok: false, error: 'No room with that code.' });
    a.socket.close();
    const reg = await request(srv.app).post('/api/auth/register').send({ username: 'cheater', email: 'c@x.dev', password: 'secret123' });
    expect(reg.status).toBe(201);
    const res = await request(srv.app)
      .post('/api/scores')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({ game: 'museum-hide-seek', score: 999, durationMs: 60000 });
    expect(res.status).toBe(403);
  });
});
