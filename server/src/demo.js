/**
 * Runs the API with a temporary in-memory MongoDB and sample players, so the
 * leaderboards aren't empty. No database setup needed; data resets on stop.
 *
 *   npm run demo     then log in as  demo / demo12345
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET ||= crypto.randomBytes(32).toString('hex');
const config = require('./config');
const { createServer } = require('./server');
const { User, Score } = require('./models');

const PLAYERS = [
  ['demo', 'fox'], ['SkyDasher', 'owl'], ['NeonNinja', 'cat'], ['RooftopRia', 'tiger'],
  ['PixelPanda', 'panda'], ['KoalaKid', 'koala'], ['LoneWolf', 'wolf'], ['FrogLeap', 'frog'],
];

async function seed() {
  const hash = await bcrypt.hash('demo12345', 10);
  const users = await User.insertMany(
    PLAYERS.map(([name, avatar]) => ({ username: name, usernameKey: name.toLowerCase(), email: `${name.toLowerCase()}@playverse.dev`, avatar, passwordHash: hash })),
  );
  const scores = [];
  for (const u of users) {
    for (let i = 0; i < 4; i++) {
      const seconds = 40 + Math.random() * 140;
      const distance = Math.round(seconds * (14 + Math.random() * 8));
      const coins = Math.round(distance / (18 + Math.random() * 10));
      scores.push({
        user: u._id,
        game: 'rooftop-runner',
        score: distance + coins * 10,
        stats: { distance, coins },
        durationMs: Math.round(seconds * 1000),
        createdAt: new Date(Date.now() - Math.random() * 12 * 86_400_000),
      });
    }
  }
  await Score.insertMany(scores);
}

async function main() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await seed();
  createServer().server.listen(config.port, () => {
    console.log(`\nPlayverse demo API on http://localhost:${config.port} (in-memory database)`);
    console.log('Log in with  demo / demo12345\n');
  });
  const stop = async () => {
    await mongo.stop();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
