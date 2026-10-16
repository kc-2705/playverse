process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const { describe, test, before, after, beforeEach } = require('node:test');
const { expect } = require('expect');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../src/app');

let mongo;
let app;
before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  app = createApp();
});
after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});

async function signUp(name) {
  const res = await request(app).post('/api/auth/register').send({ username: name, email: `${name}@x.dev`, password: 'secret123' });
  expect(res.status).toBe(201);
  return { Authorization: `Bearer ${res.body.token}` };
}

const run = (score, seconds = 60) => ({ game: 'rooftop-runner', score, durationMs: seconds * 1000, stats: { distance: score, coins: 3 } });

describe('accounts', () => {
  test('register, log in with username or email, and never return the password', async () => {
    const reg = await request(app).post('/api/auth/register').send({ username: 'Kavya_K', email: 'k@x.dev', password: 'secret123' });
    expect(reg.status).toBe(201);
    expect(JSON.stringify(reg.body)).not.toContain('secret123');
    expect((await request(app).post('/api/auth/login').send({ login: 'kavya_k', password: 'secret123' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ login: 'K@X.dev', password: 'secret123' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ login: 'kavya_k', password: 'wrong-pass' })).status).toBe(401);
  });

  test('usernames are unique regardless of case', async () => {
    await signUp('Rider');
    const dup = await request(app).post('/api/auth/register').send({ username: 'rider', email: 'other@x.dev', password: 'secret123' });
    expect(dup.status).toBe(409);
  });
});

describe('scores and leaderboards', () => {
  test('saving a score needs a login', async () => {
    expect((await request(app).post('/api/scores').send(run(500))).status).toBe(401);
  });

  test('impossible scores are rejected', async () => {
    const auth = await signUp('cheater');
    const tooFast = await request(app).post('/api/scores').set(auth).send(run(999999, 10));
    expect(tooFast.status).toBe(422);
    const tooShort = await request(app).post('/api/scores').set(auth).send(run(10, 1));
    expect(tooShort.status).toBe(422);
    const unknown = await request(app).post('/api/scores').set(auth).send({ ...run(100), game: 'nope' });
    expect(unknown.status).toBe(400);
  });

  test('leaderboard shows each player once, by their best score', async () => {
    const a = await signUp('alpha');
    const b = await signUp('bravo');
    for (const s of [800, 1200, 900]) await request(app).post('/api/scores').set(a).send(run(s));
    await request(app).post('/api/scores').set(b).send(run(1000));
    const res = await request(app).get('/api/leaderboard/rooftop-runner').set(b);
    expect(res.body.top.map((r) => [r.username, r.score])).toEqual([['alpha', 1200], ['bravo', 1000]]);
    expect(res.body.me).toEqual(expect.objectContaining({ rank: 2, score: 1000 }));
  });

  test('a new personal best is flagged', async () => {
    const a = await signUp('charlie');
    const first = await request(app).post('/api/scores').set(a).send(run(500));
    expect(first.body).toEqual(expect.objectContaining({ personalBest: true, rank: 1 }));
    const worse = await request(app).post('/api/scores').set(a).send(run(300));
    expect(worse.body).toEqual(expect.objectContaining({ personalBest: false, previousBest: 500 }));
  });

  test('my stats add up plays and best per game', async () => {
    const a = await signUp('delta');
    await request(app).post('/api/scores').set(a).send(run(400, 30));
    await request(app).post('/api/scores').set(a).send(run(700, 50));
    const res = await request(app).get('/api/me/stats').set(a);
    expect(res.body.games[0]).toEqual(expect.objectContaining({ game: 'rooftop-runner', best: 700, plays: 2, timeMs: 80000 }));
  });
});
