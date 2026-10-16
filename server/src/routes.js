const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const config = require('./config');
const { User, Score } = require('./models');
const { GAMES } = require('./games');
const { HttpError, signToken, requireAuth, optionalAuth } = require('./middleware');

const router = express.Router();

const limiter = (limit, minutes) =>
  rateLimit({
    windowMs: minutes * 60 * 1000,
    limit: config.isTest ? 10_000 : limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many requests. Please wait a moment and try again.' },
  });

const AVATARS = ['fox', 'owl', 'cat', 'panda', 'tiger', 'koala', 'wolf', 'frog'];
const username = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{3,20}$/, 'Use 3–20 letters, numbers or underscores.');
const password = z.string().min(8, 'Password must be at least 8 characters.').max(100);
const gameId = z.string().refine((g) => Boolean(GAMES[g]), 'Unknown game.');

const session = (user) => ({ token: signToken(user._id), user: user.toPublic() });

router.get('/health', (req, res) => res.json({ ok: true }));
router.get('/games', (req, res) => res.json(Object.entries(GAMES).map(([id, g]) => ({ id, name: g.name }))));

// ---------------------------------------------------------------- accounts
router.post('/auth/register', limiter(20, 15), async (req, res) => {
  const data = z
    .object({ username, email: z.email('Enter a valid email.').toLowerCase(), password, avatar: z.enum(AVATARS).optional() })
    .parse(req.body);
  const key = data.username.toLowerCase();
  if (await User.exists({ usernameKey: key })) throw new HttpError(409, 'That username is taken.');
  if (await User.exists({ email: data.email })) throw new HttpError(409, 'An account with this email already exists.');
  const user = await User.create({
    username: data.username,
    usernameKey: key,
    email: data.email,
    avatar: data.avatar ?? AVATARS[Math.floor(Math.random() * AVATARS.length)],
    passwordHash: await bcrypt.hash(data.password, 12),
  });
  res.status(201).json(session(user));
});

router.post('/auth/login', limiter(30, 15), async (req, res) => {
  const { login, password: pw } = z.object({ login: z.string().trim().min(1, 'Enter your username or email.'), password: z.string().min(1) }).parse(req.body);
  const query = login.includes('@') ? { email: login.toLowerCase() } : { usernameKey: login.toLowerCase() };
  const user = await User.findOne(query).select('+passwordHash');
  if (!user || !(await bcrypt.compare(pw, user.passwordHash))) throw new HttpError(401, 'Username, email or password is incorrect.');
  res.json(session(user));
});

router.get('/auth/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, 'Please log in.');
  res.json({ user: user.toPublic() });
});

router.put('/auth/me', requireAuth, async (req, res) => {
  const { avatar } = z.object({ avatar: z.enum(AVATARS) }).parse(req.body);
  const user = await User.findByIdAndUpdate(req.userId, { avatar }, { returnDocument: 'after' });
  res.json({ user: user.toPublic() });
});

// ---------------------------------------------------------------- scores
const scoreBody = z.object({
  game: gameId,
  score: z.number().int().min(0).max(10_000_000),
  durationMs: z.number().int().min(0).max(6 * 60 * 60 * 1000),
  stats: z.record(z.string().max(20), z.number().min(0).max(10_000_000)).optional().default({}),
});

router.post('/scores', requireAuth, limiter(60, 1), async (req, res) => {
  const data = scoreBody.parse(req.body);
  const rules = GAMES[data.game];
  if (rules.serverOnly) throw new HttpError(403, 'Scores for this game are saved by the game server.');
  const seconds = data.durationMs / 1000;
  // Basic cheat check: a score the game can't produce in that time is rejected.
  if (seconds < rules.minSeconds) throw new HttpError(422, 'That run was too short to count.');
  if (data.score > Math.ceil(seconds * rules.maxPerSecond) + 50) throw new HttpError(422, 'That score isn’t possible in the time played.');

  const previousBest = await Score.findOne({ user: req.userId, game: data.game }).sort({ score: -1 }).lean();
  const saved = await Score.create({ ...data, user: req.userId });
  const rank = (await bestPerUser(data.game, {})).findIndex((r) => r.userId === req.userId) + 1;
  res.status(201).json({
    id: saved._id,
    personalBest: !previousBest || data.score > previousBest.score,
    previousBest: previousBest?.score ?? null,
    rank: rank || null,
  });
});

const PERIODS = {
  all: () => ({}),
  week: () => ({ createdAt: { $gte: new Date(Date.now() - 7 * 86_400_000) } }),
  today: () => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return { createdAt: { $gte: d } };
  },
};

/** Each player's single best score for a game, highest first. */
async function bestPerUser(game, extraMatch, limit = 1000) {
  const rows = await Score.aggregate([
    { $match: { game, ...extraMatch } },
    { $sort: { score: -1, createdAt: 1 } },
    { $group: { _id: '$user', score: { $first: '$score' }, stats: { $first: '$stats' }, at: { $first: '$createdAt' } } },
    { $sort: { score: -1, at: 1 } },
    { $limit: limit },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
  ]);
  return rows.map((r) => ({ userId: r._id.toString(), username: r.u.username, avatar: r.u.avatar, score: r.score, stats: r.stats, at: r.at }));
}

router.get('/leaderboard/:game', optionalAuth, async (req, res) => {
  const game = gameId.parse(req.params.game);
  const period = z.enum(['all', 'week', 'today']).catch('all').parse(req.query.period);
  const rows = await bestPerUser(game, PERIODS[period](), 1000);
  const top = rows.slice(0, 20).map((r, i) => ({ rank: i + 1, ...r }));
  const mineIndex = req.userId ? rows.findIndex((r) => r.userId === req.userId) : -1;
  res.json({ game, period, players: rows.length, top, me: mineIndex >= 0 ? { rank: mineIndex + 1, ...rows[mineIndex] } : null });
});

router.get('/me/stats', requireAuth, async (req, res) => {
  const user = new mongoose.Types.ObjectId(req.userId);
  const perGame = await Score.aggregate([
    { $match: { user } },
    { $group: { _id: '$game', best: { $max: '$score' }, plays: { $sum: 1 }, timeMs: { $sum: '$durationMs' }, last: { $max: '$createdAt' } } },
  ]);
  const recent = await Score.find({ user }).sort({ createdAt: -1 }).limit(10).lean();
  res.json({
    games: perGame.map((g) => ({ game: g._id, best: g.best, plays: g.plays, timeMs: g.timeMs, last: g.last })),
    totals: {
      plays: perGame.reduce((s, g) => s + g.plays, 0),
      timeMs: perGame.reduce((s, g) => s + g.timeMs, 0),
    },
    recent: recent.map((s) => ({ game: s.game, score: s.score, stats: s.stats, at: s.createdAt })),
  });
});

module.exports = router;
