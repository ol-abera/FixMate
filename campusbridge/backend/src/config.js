import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Always load backend/.env, no matter which folder the command is run from.
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const env = process.env;
const isProduction = env.NODE_ENV === 'production';

const problems = [];
if (!env.DATABASE_URL) problems.push('DATABASE_URL is missing.');
if (!env.JWT_SECRET) problems.push('JWT_SECRET is missing.');
else if (env.JWT_SECRET.startsWith('REPLACE_WITH')) problems.push('JWT_SECRET is still the placeholder value from .env.example.');
else if (env.JWT_SECRET.length < 32) {
  const msg = 'JWT_SECRET is shorter than 32 characters. Generate a stronger one (see README).';
  if (isProduction) problems.push(msg);
  else console.warn(`WARNING: ${msg}`);
}

if (problems.length) {
  console.error('\nCampusBridge API cannot start:');
  problems.forEach((p) => console.error(`  - ${p}`));
  console.error('\nCreate backend/.env by copying backend/.env.example and fill in the values.\n');
  process.exit(1);
}

const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];

export const config = {
  isProduction,
  port: Number(env.PORT) || 5000,
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET,
  // Demo accounts have PUBLIC passwords, so they can never be switched on in production.
  seedDemoAccounts: env.SEED_DEMO_ACCOUNTS === 'true' && !isProduction,
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  // Optional. Number of reverse proxies in front of the API (e.g. 1). Leave unset when running locally.
  trustProxy: env.TRUST_PROXY ? (Number.isNaN(Number(env.TRUST_PROXY)) ? env.TRUST_PROXY : Number(env.TRUST_PROXY)) : false,
  // AI learning assistant. The key stays on the server: it is never sent to the browser or written to logs.
  // LLM_PROVIDER: 'anthropic' (default) or 'openai' (any OpenAI-compatible chat API). Without LLM_API_KEY the assistant is switched off.
  llm: {
    provider: env.LLM_PROVIDER === 'openai' ? 'openai' : 'anthropic',
    apiKey: env.LLM_API_KEY || env.ANTHROPIC_API_KEY || '',
    model: env.LLM_MODEL || 'claude-haiku-5-5',
    baseUrl: (env.LLM_BASE_URL || '').replace(/\/+$/, ''),
    timeoutMs: Number(env.LLM_TIMEOUT_MS) || 30000
  },
  // CLIENT_ORIGIN may contain several origins separated by commas.
  allowedOrigins: env.CLIENT_ORIGIN
    ? env.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : defaultOrigins
};
