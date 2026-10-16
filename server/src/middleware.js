const jwt = require('jsonwebtoken');
const { ZodError } = require('zod');
const mongoose = require('mongoose');
const config = require('./config');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const signToken = (userId) => jwt.sign({ sub: userId.toString() }, config.jwtSecret(), { expiresIn: '14d' });

function readUser(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(header.slice(7), config.jwtSecret()).sub;
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }
}

/** The user id always comes from the signed token, never from the request body. */
function requireAuth(req, res, next) {
  const id = readUser(req);
  if (!id) throw new HttpError(401, 'Please log in.');
  req.userId = id;
  next();
}

/** For public pages that show extra info when signed in. */
function optionalAuth(req, res, next) {
  req.userId = readUser(req);
  next();
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const field = issue.path.join('.');
    return res.status(400).json({ message: field ? `${field}: ${issue.message}` : issue.message });
  }
  if (err instanceof mongoose.Error.CastError) return res.status(400).json({ message: 'Invalid id.' });
  if (err?.code === 11000) return res.status(409).json({ message: 'That already exists.' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body is not valid JSON.' });
  console.error(err);
  return res.status(500).json({ message: 'Something went wrong on our side. Please try again.' });
}

module.exports = { HttpError, signToken, requireAuth, optionalAuth, errorHandler };
