/*
 * Night Heist levels. Each map cell is 2 m square. Row 0 is the far (north)
 * side of the screen.
 *
 *   #  wall                 .  floor
 *   S  statue (solid)       D  glass display case (solid, guards see through it)
 *   P  player start         X  exit
 *   $  the painting (hangs on the wall north of this cell)
 *   g  gem
 *
 * Positions below are [column, row]. Angles: 0 = up the screen (north),
 * 90 = right (east).
 */

export type CellPos = [number, number];

export interface LevelDef {
  name: string;
  painting: string;
  brief: string;
  map: string[];
  guards: { path: CellPos[] }[];
  cameras: { at: CellPos; facing: number; sweep: number }[];
  /** A beam across a corridor, from cell a to cell b (same row or same column). */
  lasers: { a: CellPos; b: CellPos; on: number; off: number; offset: number }[];
}

export const LEVELS: LevelDef[] = [
  {
    name: 'The East Gallery',
    painting: 'Harbor at Midnight',
    brief: 'One guard and one camera. Learn their timing, take the painting, and slip out the side door.',
    map: [
      '##################',
      '#$....#.....g....#',
      '#.....#..........#',
      '#..S..D....S.....#',
      '#.....#..........#',
      '###.###.....######',
      '#.........g......#',
      '#..g.....S.......#',
      '#.......####..#..#',
      '#P......#X....#..#',
      '##################',
    ],
    guards: [{ path: [[4, 6], [14, 6], [14, 7], [5, 7]] }],
    cameras: [{ at: [5, 1], facing: 225, sweep: 70 }],
    lasers: [],
  },
  {
    name: 'The Sculpture Hall',
    painting: 'Lady in Blue',
    brief: 'Two guards walk the long halls and a laser guards the west corridor. Coins make good distractions.',
    map: [
      '######################',
      '#P...#.........#....X#',
      '#....#..S...S..#.....#',
      '#....D.........D.....#',
      '#....#..S...S..#.....#',
      '##.###.........###.###',
      '#.......g...........g#',
      '#..####.......####...#',
      '#..#$.#..D.D..#..#...#',
      '#..#..#.......#.g#...#',
      '#..#..##.....##..#...#',
      '#....................#',
      '######################',
    ],
    guards: [{ path: [[3, 6], [19, 6]] }, { path: [[20, 11], [1, 11]] }, { path: [[7, 2], [14, 2], [14, 4], [7, 4]] }],
    cameras: [{ at: [20, 7], facing: 315, sweep: 60 }],
    lasers: [{ a: [1, 9], b: [2, 9], on: 2.2, off: 1.6, offset: 0 }],
  },
  {
    name: 'The Vault',
    painting: 'The Golden Orchard',
    brief: 'The museum’s prize sits in a vault behind a laser. Four guards, two cameras. Stay in the shadows.',
    map: [
      '########################',
      '#X.....#...............#',
      '#......#..S..S..S..g...#',
      '#......D...............#',
      '#......#..S..S..S......#',
      '###.####...........#####',
      '#.........#######......#',
      '#..g......#..$..#......#',
      '#.........#.....#..S...#',
      '####.#######...######.##',
      '#.......#..........#...#',
      '#.......#..D....D..#.g.#',
      '#...S........P.........#',
      '#.......#..........#...#',
      '########################',
    ],
    guards: [
      { path: [[2, 6], [9, 6], [9, 8], [2, 8]] },
      { path: [[9, 2], [21, 2], [21, 4], [9, 4]] },
      { path: [[17, 6], [22, 6], [22, 8], [17, 8]] },
      { path: [[1, 10], [6, 10], [6, 13], [1, 13]] },
    ],
    cameras: [
      { at: [11, 8], facing: 45, sweep: 70 },
      { at: [6, 1], facing: 225, sweep: 60 },
    ],
    lasers: [
      { a: [12, 9], b: [14, 9], on: 1.8, off: 1.5, offset: 0.6 },
      { a: [4, 9], b: [4, 9], on: 2.4, off: 1.4, offset: 0 },
    ],
  },
];
