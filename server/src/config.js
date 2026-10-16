require('dotenv').config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
  return value;
}

module.exports = {
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || 4000,
  mongoUrl: () => required('MONGO_URL'),
  jwtSecret: () => required('JWT_SECRET'),
  // Sites allowed to call the API. Render passes the website's bare host name
  // (e.g. playverse-app.onrender.com), so https:// is added when missing.
  clientOrigins: (process.env.CLIENT_URL || 'http://localhost:5174')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .map((s) => (/^https?:\/\//.test(s) ? s : `https://${s}`)),
};
