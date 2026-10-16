const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const { createApp } = require('./app');
const { attachHideSeek } = require('./hideseek');

/** One HTTP server for the REST API and the Socket.io games. */
function createServer({ hideSeekTimes } = {}) {
  const app = createApp();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: config.clientOrigins } });
  const rooms = attachHideSeek(io, hideSeekTimes);
  return { app, server, io, rooms };
}

module.exports = { createServer };
