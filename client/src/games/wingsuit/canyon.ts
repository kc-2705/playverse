/*
 * The canyon's shape as plain math, shared by the terrain builder and the
 * collision checks. It's deterministic: every run flies the same canyon,
 * which keeps the leaderboard fair and lets the ghost replay your best line.
 *
 * World axes: +z is down-canyon (forward), +y is up. The canyon floor drops
 * by SLOPE metres per metre, close to a wingsuit's natural glide angle, so a
 * neutral glide keeps roughly the same height above the river.
 */

export const SLOPE = 0.4;

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, oct = 4) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    sum += noise(x * f, y * f) * amp;
    f *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** x of the canyon's centre line at distance z. */
export const centerX = (z: number) => 70 * Math.sin(z * 0.0021) + 28 * Math.sin(z * 0.0057 + 1.3);
/** 0 at the start, 1 from 3 km on: the canyon gets narrower and faster, with more hurdles. */
export const difficulty = (z: number) => Math.max(0, Math.min(1, z / 3000));
/** Half the width of the canyon floor. Narrows and widens as you go, and tightens with distance. */
export const halfWidth = (z: number) => Math.max(16, (30 + 11 * Math.sin(z * 0.0031 + 2) + 6 * Math.sin(z * 0.011)) * (1 - 0.3 * difficulty(z)));

/*
 * Rock dams: every ~430 m from 800 m the floor rises 24 m and drops again, so
 * a low flyer has to pull up in time.
 */
const DAM_START = 800;
const DAM_EVERY = 430;
const DAM_HEIGHT = 24;
const DAM_HALF_LENGTH = 38;
export function damHeight(z: number) {
  const k = Math.round((z - DAM_START) / DAM_EVERY);
  if (k < 0) return 0;
  const centre = DAM_START + k * DAM_EVERY + (hash(k, 7) - 0.5) * 120;
  const t = Math.abs(z - centre) / DAM_HALF_LENGTH;
  return t < 1 ? DAM_HEIGHT * (0.5 + 0.5 * Math.cos(Math.PI * t)) : 0;
}
/** Height of the river at distance z. */
export const floorY = (z: number) => -SLOPE * z + 10 * Math.sin(z * 0.004) + damHeight(z);
/** Height of the canyon rim above the river. */
export const wallHeight = (z: number) => 150 + 30 * Math.sin(z * 0.0017);

/** Ground height at (x, z): river, sloping banks, then terraced cliffs and mesa tops. */
export function terrainHeight(x: number, z: number) {
  const d = Math.abs(x - centerX(z));
  const w = halfWidth(z);
  const base = floorY(z);
  // River bed and banks.
  const bed = -3 * Math.max(0, 1 - d / (w * 0.45)) ** 2 + smooth(w * 0.45, w, d) * 6;
  // Cliffs in ledged layers, like sandstone strata.
  const rise = smooth(w * 0.9, w + 30, d + fbm(x / 40, z / 40) * 14 - 7);
  const raw = rise * (wallHeight(z) + fbm(x / 90, z / 90) * 50);
  const t = raw / 16;
  const terraced = 16 * (Math.floor(t) + smooth(0.25, 0.75, t - Math.floor(t)));
  return base + bed + terraced * 0.8 + raw * 0.2 + fbm(x / 9, z / 9, 3) * 2.2;
}

/** A small seeded random generator, so obstacles land in the same places every run. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
