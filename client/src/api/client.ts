import axios, { AxiosError } from 'axios';

const TOKEN_KEY = 'playverse.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({ baseURL: '/api' });

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
