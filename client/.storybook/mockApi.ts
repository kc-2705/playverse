import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import type { LeaderRow, User } from '../src/api/client';

/**
 * A fake game server for Storybook. Stories describe the responses they need:
 *
 *   parameters: { api: { 'POST /auth/login': fail(401, 'Wrong username or password.') } }
 *
 * A value is returned as the response body. A function receives the request
 * config and can return a body, wait with delay(), or fail with fail().
 */

type Failure = { __fail: { status: number; message: string } };
type Handler = unknown | ((config: InternalAxiosRequestConfig) => unknown);
export type Routes = Record<string, Handler>;

export const delay = <T,>(ms: number, body: T) => new Promise<T>((resolve) => setTimeout(() => resolve(body), ms));
export const fail = (status: number, message: string): Failure => ({ __fail: { status, message } });

export const DEMO_USER: User = { id: 'u1', username: 'kavya', email: 'kavya@example.com', avatar: 'fox', createdAt: '2026-10-01T00:00:00.000Z' };

const PLAYERS = [
  ['u2', 'skyline_sam', 'tiger'], ['u3', 'nightowl', 'owl'], ['u1', 'kavya', 'fox'], ['u4', 'pandarun', 'panda'],
  ['u5', 'frogleap', 'frog'], ['u6', 'wolfpack', 'wolf'], ['u7', 'koalakid', 'koala'], ['u8', 'catnap', 'cat'],
] as const;

/** Sample scores with the details each game records. */
export function sampleRows(stats: (i: number) => Record<string, number>): LeaderRow[] {
  return PLAYERS.map(([userId, username, avatar], i) => ({
    rank: i + 1,
    userId,
    username,
    avatar,
    score: Math.round(48200 / (1 + i * 0.35)),
    stats: stats(i),
    at: '2026-11-12T18:00:00.000Z',
  }));
}

export function mockAdapter(routes: Routes): AxiosAdapter {
  return async (config) => {
    const key = `${(config.method ?? 'get').toUpperCase()} ${config.url}`;
    const response = (status: number, data: unknown) => ({ data, status, statusText: String(status), headers: {}, config, request: {} });
    const reject = (status: number, message: string): never => {
      throw new AxiosError(message, String(status), config, {}, response(status, { message }));
    };

    if (!(key in routes)) reject(404, `Storybook has no mock for ${key}`);
    const handler = routes[key];
    const body = typeof handler === 'function' ? await handler(config) : handler;
    if ((body as Failure | undefined)?.__fail) reject((body as Failure).__fail.status, (body as Failure).__fail.message);
    return response(200, body);
  };
}
