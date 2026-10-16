import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'playverse.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/**
 * The game server's address. Empty in development (Vite forwards /api to the
 * local server); set at build time when the website is hosted on its own, so
 * the site opens instantly even while the free server is still waking up.
 */
export const API_ORIGIN = (() => {
  const v = String(import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');
  if (!v) return '';
  return /^https?:\/\//.test(v) ? v : `https://${v}`;
})();

export const api = axios.create({ baseURL: `${API_ORIGIN}/api` });

/** Starts waking the server without waiting for it (called when the app opens). */
export function wakeServer() {
  fetch(`${API_ORIGIN}/api/health`).catch(() => undefined);
}

// Requests that take more than a few seconds usually mean the server is waking
// up. Tell the app so it can say so (see ServerWaking).
let slowRequests = 0;
const announce = () => window.dispatchEvent(new CustomEvent('pv:waking', { detail: slowRequests > 0 }));
type Timed = { __slowTimer?: number; __slow?: boolean };
api.interceptors.request.use((config) => {
  const c = config as typeof config & Timed;
  c.__slowTimer = window.setTimeout(() => {
    c.__slow = true;
    slowRequests++;
    announce();
  }, 3500);
  return config;
});
const settle = (config: unknown) => {
  const c = (config ?? {}) as Timed;
  window.clearTimeout(c.__slowTimer);
  if (c.__slow) {
    c.__slow = false;
    slowRequests = Math.max(0, slowRequests - 1);
    announce();
  }
};
api.interceptors.response.use(
  (res) => {
    settle(res.config);
    return res;
  },
  (err) => {
    settle(err?.config);
    return Promise.reject(err);
  },
);

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function errorMessage(error: unknown): string {
  const e = error as AxiosError<{ message?: string }>;
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.code === 'ERR_NETWORK') return 'Can’t reach the server. Check that it’s running and try again.';
  return 'Something went wrong. Please try again.';
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  createdAt: string;
}

export interface LeaderRow {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  score: number;
  stats: Record<string, number>;
  at: string;
}

export interface Leaderboard {
  game: string;
  period: 'all' | 'week' | 'today';
  players: number;
  top: LeaderRow[];
  me: LeaderRow | null;
}

export interface SubmitResult {
  personalBest: boolean;
  previousBest: number | null;
  rank: number | null;
}

export interface MyStats {
  games: { game: string; best: number; plays: number; timeMs: number; last: string }[];
  totals: { plays: number; timeMs: number };
  recent: { game: string; score: number; stats: Record<string, number>; at: string }[];
}
