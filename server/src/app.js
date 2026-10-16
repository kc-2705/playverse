const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const config = require('./config');
const routes = require('./routes');
const { errorHandler } = require('./middleware');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  // The games need WebGL, workers and blob URLs, so the default CSP is relaxed for the built client.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || config.clientOrigins.includes(origin)) }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

  app.use('/api', routes);
  app.use('/api', (req, res) => res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` }));

  // In production the API also serves the built React app.
  const dist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(dist)) {
    app.use(
      express.static(dist, {
        // Built files have a content hash in their name, so they can be cached for good.
        setHeaders(res, file) {
          if (/[\\/]assets[\\/][^\\/]+-[A-Za-z0-9_-]{8,}\.(js|css)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else if (/sw\.js$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
