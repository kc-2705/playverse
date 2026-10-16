import { seeded } from '../wingsuit/canyon';

/*
 * The Hide & Seek museum: four corner galleries, two centre galleries and a
 * long hall between them. Same grid language as Night Heist (2 m cells):
 *   # wall   . floor   S statue on a plinth (solid)   D display case (solid)
 * The server keeps a copy of the outer bounds and the spawn points, so if
 * this map changes, update SPAWNS and BOUNDS in server/src/hideseek.js too.
 */

export const CELL = 2;
export const MAP = [
  '##########################',
  '#.......#.........#......#',
  '#.......#....S....#......#',
  '#.......D.........D......#',
  '#.......#.........#......#',
  '#.......#....S....#......#',
  '####.#######...#######.###',
  '#........................#',
  '#...S......D....D......S.#',
  '#........................#',
  '####.#######...#######.###',
  '#.......#.........#......#',
  '#.......#....S....#......#',
  '#.......D.........D......#',
  '#.......#.........#......#',
  '#.......#.........#......#',
  '##########################',
];
export const ROWS = MAP.length;
export const COLS = MAP[0].length;

export type Kind = 'vase' | 'bust' | 'bench' | 'plant';
export const KINDS: Kind[] = ['vase', 'bust', 'bench', 'plant'];
export const KIND_LABELS: Record<Kind, string> = { vase: 'Vase', bust: 'Marble bust', bench: 'Bench', plant: 'Potted plant' };
/** Collision radius of each disguise / decoy. */
export const KIND_RADIUS: Record<Kind, number> = { vase: 0.35, bust: 0.4, bench: 0.6, plant: 0.4 };

export const cellX = (c: number) => c * CELL;
export const cellZ = (r: number) => (ROWS - 1 - r) * CELL;
export const toCell = (x: number, z: number): [number, number] => [Math.round(x / CELL), ROWS - 1 - Math.round(z / CELL)];
export const at = (c: number, r: number) => MAP[r]?.[c] ?? '#';
export const solid = (c: number, r: number) => '#SD'.includes(at(c, r));
export const opaqueAt = (x: number, z: number) => '#S'.includes(at(...toCell(x, z)));

/** Spawn cells; must match the server's SPAWNS (in world metres). */
export const SPAWN_CELLS: [number, number][] = [[2, 2], [23, 2], [2, 14], [23, 14]];

export interface Decoy {
  id: string;
  kind: Kind;
  x: number;
  z: number;
  yaw: number;
}

/** The museum's objects, placed the same way on every client from the room's seed. */
export function decoys(seed: number, perKind = 9): Decoy[] {
  const rand = seeded(seed);
  const free: [number, number][] = [];
  MAP.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch !== '.') return;
      // Keep doorways, the hall's door rows and spawn corners clear.
      if (r === 6 || r === 10) return;
      if (SPAWN_CELLS.some(([sc, sr]) => Math.abs(sc - c) <= 1 && Math.abs(sr - r) <= 1)) return;
      if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dc, dr]) => at(c + dc, r + dr) === 'D')) return;
      free.push([c, r]);
    }),
  );
  // Shuffle, then take cells one by one so objects never share a cell.
  for (let i = free.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  const out: Decoy[] = [];
  let k = 0;
  for (const kind of KINDS) {
    for (let i = 0; i < perKind && k < free.length; i++, k++) {
      const [c, r] = free[k];
      out.push({ id: `${kind}${i}`, kind, x: cellX(c) + (rand() - 0.5) * 0.8, z: cellZ(r) + (rand() - 0.5) * 0.8, yaw: Math.floor(rand() * 4) * (Math.PI / 2) + (rand() - 0.5) * 0.3 });
    }
  }
  return out;
}
