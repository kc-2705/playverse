/*
 * Museum Hide & Seek: real-time multiplayer over Socket.io.
 *
 * The server is the referee. It owns the rooms, the round timer, who hides,
 * and whether a tag actually found the hider; clients only send their own
 * movement and their guesses. Moves are checked against a speed limit and the
 * map bounds, so a modified client can't teleport.
 *
 * Round flow: lobby → hide (seekers can't see or move) → seek → results,
 * repeated until every player has hidden once, then final standings.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { User, Score } = require('./models');

const KINDS = ['vase', 'bust', 'bench', 'plant'];
const COLORS = ['#ff8a3d', '#4fc3f7', '#9ccc65', '#f06292', '#ffd54f', '#b39ddb', '#4db6ac', '#e57373'];
// The client's museum map is 26 × 17 cells of 2 m; positions stay inside it.
const BOUNDS = { minX: 1, maxX: 50, minZ: 1, maxZ: 34 };
// The four corner rooms' spawn points (cell centres from the client map).
const SPAWNS = [[4, 28], [46, 28], [4, 4], [46, 4]];
const SPEED = { seeker: 5, hider: 2.6 };
const MAX_PLAYERS = 8;
const TICK_MS = 66;
const TAG_REACH = 3.2;
const TAG_HIT = 1.3;
// A wrong tag freezes the seeker for missFreezeMs and takes missPenaltyMs off the clock.
const DEFAULT_TIMES = { hideMs: 30_000, seekMs: 120_000, resultsMs: 7_000, rejoinMs: 60_000, missFreezeMs: 2_000, missPenaltyMs: 5_000 };

const code4 = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(4), (b) => letters[b % letters.length]).join('');
};
const clean = (s, max = 16) => String(s ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, max);
const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

class Room {
  constructor(code, times, onChange) {
    this.code = code;
    this.times = times;
    this.onChange = onChange; // (room, kind, payload) → broadcast
    this.seed = crypto.randomInt(1, 2 ** 31);
    this.players = new Map();
    this.order = [];
    this.hostId = null;
    this.phase = 'lobby';
    this.round = 0;
    this.rounds = 0;
    this.hiderId = null;
    this.endsAt = 0;
    this.timer = null;
    this.matchStarted = 0;
  }

  get connected() {
    return [...this.players.values()].filter((p) => p.connected);
  }

  addPlayer({ name, avatar, userId }) {
    const id = crypto.randomUUID();
    const used = new Set([...this.players.values()].map((p) => p.color));
    const p = {
      id,
      name: name || `Guest ${this.players.size + 1}`,
      avatar: avatar || 'fox',
      userId: userId || null,
      color: COLORS.find((c) => !used.has(c)) ?? COLORS[this.players.size % COLORS.length],
      x: 0,
      z: 0,
      yaw: 0,
      moving: false,
      lastMove: 0,
      disguise: KINDS[0],
      score: 0,
      found: 0,
      hidden: false,
      connected: true,
      frozenUntil: 0,
      leftAt: 0,
    };
    this.players.set(id, p);
    this.order.push(id);
    if (!this.hostId) this.hostId = id;
    return p;
  }

  /** Public view of the room; the same for every player. */
  snapshot() {
    return {
      code: this.code,
      seed: this.seed,
      hostId: this.hostId,
      phase: this.phase,
      round: this.round,
      rounds: this.rounds,
      hiderId: this.hiderId,
      endsAt: this.endsAt,
      now: Date.now(),
      players: this.order
        .map((id) => this.players.get(id))
        .filter(Boolean)
        .map(({ id, name, avatar, color, score, found, connected, disguise, frozenUntil, x, z }) => ({ id, name, avatar, color, score, found, connected, disguise, frozenUntil, x, z })),
    };
  }

  setPhase(phase, ms) {
    clearTimeout(this.timer);
    this.phase = phase;
    this.endsAt = ms ? Date.now() + ms : 0;
    if (ms) this.timer = setTimeout(() => this.advance(), ms);
    this.onChange(this, 'room');
  }

  start(byId) {
    if (byId !== this.hostId) return 'Only the host can start.';
    if (!['lobby', 'final'].includes(this.phase)) return 'A game is already running.';
    if (this.connected.length < 2) return 'You need at least 2 players.';
    for (const p of this.players.values()) Object.assign(p, { score: 0, found: 0, hidden: false });
    this.round = 0;
    this.rounds = this.connected.length;
    this.matchStarted = Date.now();
    this.nextRound();
    return null;
  }

  nextRound() {
    const next = this.order.map((id) => this.players.get(id)).find((p) => p && p.connected && !p.hidden);
    if (!next) return this.finish();
    this.round++;
    next.hidden = true;
    this.hiderId = next.id;
    // The server places everyone, so a round never starts with a teleport the move check would reject.
    const s = crypto.randomInt(SPAWNS.length);
    const seekerSpawn = SPAWNS[(s + 3) % SPAWNS.length];
    let i = 0;
    for (const p of this.players.values()) {
      const [x, z] = p.id === next.id ? SPAWNS[s] : [seekerSpawn[0] + (i % 3) - 1, seekerSpawn[1] - Math.floor(i++ / 3)];
      Object.assign(p, { x, z, lastMove: 0, frozenUntil: 0, disguise: p.id === next.id ? p.disguise : KINDS[0] });
    }
    this.onChange(this, 'event', { type: 'round', round: this.round, hiderId: next.id, name: next.name });
    this.setPhase('hide', this.times.hideMs);
  }

  advance() {
    if (this.phase === 'hide') this.setPhase('seek', this.times.seekMs);
    else if (this.phase === 'seek') this.endRound(null);
    else if (this.phase === 'results') this.nextRound();
  }

  endRound(foundBy) {
    const hider = this.players.get(this.hiderId);
    if (hider && !foundBy) {
      hider.score += 150;
      this.onChange(this, 'event', { type: 'timeup', hiderId: hider.id, name: hider.name, points: 150 });
    }
    this.setPhase('results', this.times.resultsMs);
  }

  async finish() {
    this.hiderId = null;
    this.setPhase('final', 0);
    // Scores come from the server's own count, so they can't be faked by a client.
    const durationMs = Date.now() - this.matchStarted;
    const saves = [...this.players.values()]
      .filter((p) => p.userId && p.score > 0)
      .map((p) => Score.create({ user: p.userId, game: 'museum-hide-seek', score: p.score, durationMs, stats: { found: p.found, rounds: this.rounds } }));
    await Promise.allSettled(saves);
  }

  move(p, { x, z, yaw, moving, disguise }) {
    const now = Date.now();
    if (this.phase === 'hide' && p.id !== this.hiderId) return; // seekers wait with their eyes closed
    if (now < p.frozenUntil) return;
    x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, num(x, p.x)));
    z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, num(z, p.z)));
    const dt = Math.min(1, (now - (p.lastMove || now)) / 1000);
    // Speed limit with a little slack for network jitter; dt runs from the last accepted move.
    const limit = (p.id === this.hiderId ? SPEED.hider : SPEED.seeker) * dt * 1.5 + 0.15;
    // Too far in one step: ignore it (the client will be corrected by the next tick).
    if (p.lastMove && Math.hypot(x - p.x, z - p.z) > limit) return;
    Object.assign(p, { x, z, yaw: num(yaw, p.yaw), moving: Boolean(moving), lastMove: now });
    if (p.id === this.hiderId && KINDS.includes(disguise) && p.disguise !== disguise) {
      p.disguise = disguise;
      this.onChange(this, 'room');
    }
  }

  /** A seeker guesses that the object at (x, z) is the hider. */
  tag(p, { x, z }) {
    if (this.phase !== 'seek' || p.id === this.hiderId) return { ok: false, reason: 'You can’t tag right now.' };
    if (Date.now() < p.frozenUntil) return { ok: false, reason: 'Wait a moment.' };
    x = num(x, NaN);
    z = num(z, NaN);
    if (!Number.isFinite(x) || Math.hypot(x - p.x, z - p.z) > TAG_REACH) return { ok: false, reason: 'Too far away.' };
    const hider = this.players.get(this.hiderId);
    if (hider && Math.hypot(x - hider.x, z - hider.z) < TAG_HIT) {
      const left = Math.max(0, Math.round((this.endsAt - Date.now()) / 1000));
      const points = 100 + left;
      p.score += points;
      p.found++;
      hider.score += Math.round((this.times.seekMs / 1000 - left) / 2); // a point for every 2 s survived
      this.onChange(this, 'event', { type: 'found', byId: p.id, by: p.name, hiderId: hider.id, name: hider.name, points });
      this.endRound(p.id);
      return { ok: true, found: true };
    }
    // Wrong guess: the seeker freezes for a moment and the clock loses 5 s.
    p.frozenUntil = Date.now() + this.times.missFreezeMs;
    this.endsAt -= this.times.missPenaltyMs;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.advance(), Math.max(0, this.endsAt - Date.now()));
    this.onChange(this, 'event', { type: 'miss', byId: p.id, by: p.name });
    this.onChange(this, 'room');
    return { ok: true, found: false };
  }

  disconnect(p) {
    p.connected = false;
    p.leftAt = Date.now();
    this.onChange(this, 'event', { type: 'leave', name: p.name });
    if (this.hostId === p.id) this.hostId = this.connected[0]?.id ?? null;
    // The hider left mid-round: end the round without points.
    if (p.id === this.hiderId && ['hide', 'seek'].includes(this.phase)) this.setPhase('results', this.times.resultsMs);
    else this.onChange(this, 'room');
  }

  dispose() {
    clearTimeout(this.timer);
  }
}

async function userFromToken(token) {
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, config.jwtSecret());
    return await User.findById(sub);
  } catch {
    return null;
  }
}

/** Wires Hide & Seek onto a Socket.io server. Returns the rooms map (handy for tests). */
function attachHideSeek(io, times = {}) {
  const t = { ...DEFAULT_TIMES, ...times };
  const rooms = new Map();

  const onChange = (room, kind, payload) => {
    if (kind === 'room') io.to(room.code).emit('room', room.snapshot());
    else io.to(room.code).emit('event', payload);
  };

  // Send everyone's position to each room with company, 15 times a second.
  const ticker = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.connected.length > 1) {
        io.to(room.code).emit('tick', {
          t: now,
          players: room.connected.map((p) => [p.id, Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100, Math.round(p.yaw * 100) / 100, p.moving ? 1 : 0]),
        });
      }
      // Forget players who never came back, and empty rooms.
      for (const p of room.players.values()) {
        if (!p.connected && now - p.leftAt > t.rejoinMs) {
          room.players.delete(p.id);
          room.order = room.order.filter((id) => id !== p.id);
        }
      }
      if (!room.players.size) {
        room.dispose();
        rooms.delete(room.code);
      }
    }
  }, TICK_MS);
  ticker.unref(); // don't keep the process alive just for this timer
  io.engine?.on('close', () => clearInterval(ticker));

  io.on('connection', (socket) => {
    let room = null;
    let player = null;

    socket.on('join', async (msg = {}, ack = () => {}) => {
      try {
        if (room) return ack({ ok: false, error: 'Already in a room.' });
        const user = await userFromToken(socket.handshake.auth?.token);
        if (msg.create) {
          let code = code4();
          while (rooms.has(code)) code = code4();
          room = new Room(code, t, onChange);
          rooms.set(code, room);
        } else {
          room = rooms.get(String(msg.code ?? '').toUpperCase().trim()) ?? null;
          if (!room) return ack({ ok: false, error: 'No room with that code.' });
        }
        // Coming back after a dropped connection keeps your score and place.
        const back = msg.playerId && room.players.get(String(msg.playerId));
        if (back) {
          player = back;
          player.connected = true;
          if (!room.hostId) room.hostId = player.id;
        } else {
          if (room.connected.length >= MAX_PLAYERS) {
            room = null;
            return ack({ ok: false, error: 'That room is full.' });
          }
          player = room.addPlayer({
            name: user?.username ?? clean(msg.name) ?? undefined,
            avatar: user?.avatar,
            userId: user?._id?.toString(),
          });
        }
        socket.join(room.code);
        ack({ ok: true, code: room.code, playerId: player.id, kinds: KINDS });
        onChange(room, 'event', { type: 'join', name: player.name });
        onChange(room, 'room');
      } catch (err) {
        ack({ ok: false, error: 'Could not join.' });
        console.error(err);
      }
    });

    socket.on('start', (_msg, ack = () => {}) => {
      if (!room || !player) return ack({ ok: false, error: 'Join a room first.' });
      const error = room.start(player.id);
      ack(error ? { ok: false, error } : { ok: true });
    });

    socket.on('move', (msg = {}) => {
      if (room && player) room.move(player, msg);
    });

    socket.on('tag', (msg = {}, ack = () => {}) => {
      if (!room || !player) return ack({ ok: false, reason: 'Join a room first.' });
      ack(room.tag(player, msg));
    });

    const leave = () => {
      if (!room || !player) return;
      room.disconnect(player);
      socket.leave(room.code);
      room = null;
      player = null;
    };
    socket.on('leave', leave);
    socket.on('disconnect', leave);
  });

  return rooms;
}

module.exports = { attachHideSeek, Room, KINDS };
