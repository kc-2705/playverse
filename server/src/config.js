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
  clientOrigins: (process.env.CLIENT_URL || 'http://localhost:5174').split(',').map((s) => s.trim()),
};
