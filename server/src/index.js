const mongoose = require('mongoose');
const config = require('./config');
const { createServer } = require('./server');

async function start() {
  await mongoose.connect(config.mongoUrl());
  console.log('Connected to MongoDB');
  createServer().server.listen(config.port, () => console.log(`Playverse API on http://localhost:${config.port}`));
}

start().catch((err) => {
  console.error(`Could not start: ${err.message}`);
  process.exit(1);
});
