import { io, type Socket } from 'socket.io-client';
import type { Kind } from './map';
import { API_ORIGIN } from '../../api/client';

/* The browser side of the Hide & Seek connection (see server/src/hideseek.js). */

export type Phase = 'lobby' | 'hide' | 'seek' | 'results' | 'final';
export interface RoomPlayer {
  id: string;
  name: string;
  avatar: string;
  color: string;
  score: number;
  found: number;
  connected: boolean;
  disguise: Kind;
  frozenUntil: number;
  x: number;
  z: number;
}
export interface RoomState {
  code: string;
  seed: number;
  hostId: string | null;
  phase: Phase;
  round: number;
  rounds: number;
  hiderId: string | null;
  endsAt: number;
  now: number;
  players: RoomPlayer[];
}
/** [id, x, z, yaw, moving] for each connected player. */
export interface Tick {
  t: number;
  players: [string, number, number, number, number][];
}
export interface GameEvent {
  type: 'join' | 'leave' | 'round' | 'found' | 'miss' | 'timeup';
  name?: string;
  by?: string;
  byId?: string;
  hiderId?: string;
  points?: number;
  round?: number;
}
export interface JoinResult {
  ok: boolean;
  code?: string;
  playerId?: string;
  error?: string;
}

const SAVED = 'pv.hideseek.session';

export class HideSeekNet {
  private socket: Socket;
  code: string | null = null;
  playerId: string | null = null;
  /** Server time minus local time, so countdowns match the server's. */
  clockOffset = 0;

  constructor(handlers: { onRoom: (r: RoomState) => void; onTick: (t: Tick) => void; onEvent: (e: GameEvent) => void; onStatus: (connected: boolean) => void }) {
    let token: string | null = null;
    try {
      token = localStorage.getItem('playverse.token');
    } catch {
      token = null;
    }
    const opts = { path: '/socket.io', auth: token ? { token } : {}, transports: ['websocket', 'polling'] };
    this.socket = API_ORIGIN ? io(API_ORIGIN, opts) : io(opts);
    this.socket.on('room', (r: RoomState) => {
      this.clockOffset = r.now - Date.now();
      handlers.onRoom(r);
    });
    this.socket.on('tick', handlers.onTick);
    this.socket.on('event', handlers.onEvent);
    this.socket.on('disconnect', () => handlers.onStatus(false));
    this.socket.on('connect', async () => {
      handlers.onStatus(true);
      // After a dropped connection, take our place in the room again.
      if (this.code && this.playerId) await this.emit<JoinResult>('join', { code: this.code, playerId: this.playerId });
    });
  }

  /** Joining waits longer: the first visit may have to wait for the server to wake up. */
  private emit<T>(event: string, msg?: unknown, waitMs = 8000) {
    return new Promise<T>((resolve) => this.socket.timeout(waitMs).emit(event, msg, (err: Error | null, res: T) => resolve(err ? ({ ok: false, error: 'The server didn’t answer. Check your connection.' } as T) : res)));
  }

  async join(msg: { create?: boolean; code?: string; name?: string }) {
    let playerId: string | undefined;
    try {
      const saved = JSON.parse(sessionStorage.getItem(SAVED) || 'null');
      if (saved && msg.code && saved.code === msg.code.toUpperCase()) playerId = saved.playerId;
    } catch {
      playerId = undefined;
    }
    const res = await this.emit<JoinResult>('join', { ...msg, playerId }, 75_000);
    if (res.ok) {
      this.code = res.code!;
      this.playerId = res.playerId!;
      try {
        sessionStorage.setItem(SAVED, JSON.stringify({ code: this.code, playerId: this.playerId }));
      } catch {
        /* rejoining after a refresh just won't work */
      }
    }
    return res;
  }

  start() {
    return this.emit<{ ok: boolean; error?: string }>('start');
  }

  move(msg: { x: number; z: number; yaw: number; moving: boolean; disguise?: Kind }) {
    // Volatile: if the network is busy, drop old positions rather than queue them.
    this.socket.volatile.emit('move', msg);
  }

  tag(x: number, z: number) {
    return this.emit<{ ok: boolean; found?: boolean; reason?: string }>('tag', { x, z });
  }

  serverNow() {
    return Date.now() + this.clockOffset;
  }

  dispose() {
    this.socket.emit('leave');
    this.socket.disconnect();
  }
}
