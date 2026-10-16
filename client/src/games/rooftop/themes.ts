/*
 * Rooftop Runner worlds. Plain data (no Babylon imports) so the menu can show
 * the list without loading the 3D engine. Colors are hex strings.
 */

export type ThemeId = 'city' | 'mountains' | 'hills' | 'village' | 'halloween';

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  blurb: string;
  thumb: string; // picture for the menu
  swatch: string; // CSS fallback while the picture loads
  loading: string;
  reasons: { unit: string; pipe: string; tank: string; fall: string; wall: string };
  look: {
    /** Sky gradient from below the horizon (0) to straight up (1); the horizon is at 0.5. */
    sky: [number, string][];
    stars?: boolean;
    sun: { color: string; radius: number; dir: [number, number, number]; disc: [number, number, number] };
    light: { color: string; intensity: number };
    hemi: { sky: string; ground: string; intensity: number };
    env: number;
    fog: { color: string; density: number };
    exposure: number;
    contrast: number;
    vignette: string;
    glow: number;
  };
}

export const THEMES: ThemeInfo[] = [
  {
    id: 'city',
    name: 'City Sunset',
    blurb: 'Rooftops, water tanks and a chasing drone',
    thumb: '/covers/themes/city.jpg',
    swatch: 'linear-gradient(160deg, #ffb37a, #e0787a 50%, #2a2440)',
    loading: 'Loading the city…',
    reasons: {
      unit: 'You tripped over an AC unit',
      pipe: 'You hit a pipe',
      tank: 'You ran into a water tank',
      fall: 'You fell between the buildings',
      wall: 'You ran into a wall',
    },
    look: {
      sky: [[0, '#3a2433'], [0.4, '#e48a62'], [0.47, '#ffd9a6'], [0.5, '#ffb37a'], [0.56, '#e0787a'], [0.68, '#5a4a8a'], [1, '#1f2a55']],
      sun: { color: '#ffdb99', radius: 18, dir: [0.45, -0.38, 0.8], disc: [-180, 22, 420] },
      light: { color: '#ffb87a', intensity: 3.2 },
      hemi: { sky: '#bfccff', ground: '#593833', intensity: 0.35 },
      env: 0.55,
      fog: { color: '#f59e73', density: 0.0065 },
      exposure: 1.1,
      contrast: 1.12,
      vignette: '#1f0d1a',
      glow: 0.22,
    },
  },
  {
    id: 'mountains',
    name: 'Mountain Trail',
    blurb: 'A cliff-top hiking path below snowy peaks',
    thumb: '/covers/themes/mountains.jpg',
    swatch: 'linear-gradient(160deg, #6fa8e0, #dfe9f2 55%, #4c5a4a)',
    loading: 'Hiking up the trail…',
    reasons: {
      unit: 'You tripped over a boulder',
      pipe: 'You hit a fallen log',
      tank: 'You ran into a rock pillar',
      fall: 'You fell off the cliff',
      wall: 'You ran into a rock face',
    },
    look: {
      sky: [[0, '#8a9aa8'], [0.46, '#c9d8e6'], [0.5, '#e4edf5'], [0.58, '#a9cbec'], [0.75, '#5f9ad6'], [1, '#2a62a8']],
      sun: { color: '#fff6e0', radius: 55, dir: [0.35, -0.7, 0.62], disc: [-500, 1100, 1300] },
      light: { color: '#fff3e2', intensity: 3.4 },
      hemi: { sky: '#b8d0f0', ground: '#4d4a40', intensity: 0.55 },
      env: 0.7,
      fog: { color: '#d3e0ec', density: 0.0009 },
      exposure: 1.0,
      contrast: 1.1,
      vignette: '#0d1a2a',
      glow: 0.15,
    },
  },
  {
    id: 'hills',
    name: 'Green Hills',
    blurb: 'Meadows, hay bales and rolling countryside',
    thumb: '/covers/themes/hills.jpg',
    swatch: 'linear-gradient(160deg, #9cc9f0, #fff1d6 50%, #5f8f3a)',
    loading: 'Walking into the hills…',
    reasons: {
      unit: 'You tripped over a hay bale',
      pipe: 'You hit a fence rail',
      tank: 'You ran into a tree',
      fall: 'You fell into the valley',
      wall: 'You ran into a hillside',
    },
    look: {
      sky: [[0, '#9fb08a'], [0.46, '#e9e4cf'], [0.5, '#fff1d6'], [0.57, '#c4def4'], [0.75, '#86b8e8'], [1, '#3f7fcc']],
      sun: { color: '#fff2d0', radius: 50, dir: [0.5, -0.55, 0.65], disc: [-700, 600, 1400] },
      light: { color: '#ffeccc', intensity: 3.3 },
      hemi: { sky: '#c4dcf5', ground: '#4f5a33', intensity: 0.5 },
      env: 0.65,
      fog: { color: '#e6ece6', density: 0.0014 },
      exposure: 1.02,
      contrast: 1.1,
      vignette: '#1a2410',
      glow: 0.15,
    },
  },
  {
    id: 'village',
    name: 'Old Village',
    blurb: 'Town walls, cobblestones and cottages at golden hour',
    thumb: '/covers/themes/village.jpg',
    swatch: 'linear-gradient(160deg, #8fb3d9, #ffd9a0 50%, #a5532f)',
    loading: 'Opening the village gates…',
    reasons: {
      unit: 'You tripped over the crates',
      pipe: 'You got caught in the washing line',
      tank: 'You ran into the well',
      fall: 'You fell off the town wall',
      wall: 'You ran into a wall',
    },
    look: {
      sky: [[0, '#8a7a6a'], [0.45, '#f1c28e'], [0.5, '#ffdcaa'], [0.55, '#f5c39a'], [0.68, '#a9bede'], [1, '#4a6fa8']],
      sun: { color: '#ffe2a8', radius: 60, dir: [-0.55, -0.42, 0.72], disc: [520, 150, 1640] },
      light: { color: '#ffc98f', intensity: 3.1 },
      hemi: { sky: '#c3d2ec', ground: '#5c4434', intensity: 0.45 },
      env: 0.6,
      fog: { color: '#f2cfa6', density: 0.0024 },
      exposure: 1.05,
      contrast: 1.12,
      vignette: '#24140a',
      glow: 0.3,
    },
  },
  {
    id: 'halloween',
    name: 'Halloween Night',
    blurb: 'Graveyard walls, pumpkins and bats under the moon',
    thumb: '/covers/themes/halloween.jpg',
    swatch: 'linear-gradient(160deg, #1c1030, #3b1f4a 50%, #ff7a1a)',
    loading: 'Waking the ghosts…',
    reasons: {
      unit: 'You tripped over a pumpkin',
      pipe: 'You got caught in a giant web',
      tank: 'You ran into a crypt',
      fall: 'You fell into the dark',
      wall: 'You ran into a tomb wall',
    },
    look: {
      sky: [[0, '#05030a'], [0.44, '#1d1028'], [0.5, '#4a2550'], [0.54, '#2c1838'], [0.7, '#140b22'], [1, '#05040d']],
      stars: true,
      sun: { color: '#f6efcc', radius: 85, dir: [-0.3, -0.55, 0.78], disc: [-300, 270, 1680] },
      light: { color: '#9fb0ff', intensity: 1.6 },
      hemi: { sky: '#5a4a90', ground: '#1a0d1a', intensity: 0.45 },
      env: 0.22,
      fog: { color: '#2e1b40', density: 0.0045 },
      exposure: 1.25,
      contrast: 1.15,
      vignette: '#000000',
      glow: 0.7,
    },
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const themeById = (id: string) => THEMES.find((t) => t.id === id) ?? THEMES[0];
/** Run stats only hold numbers, so the theme is saved as its position in the list. */
export const themeIndex = (id: ThemeId) => THEME_IDS.indexOf(id);
export const themeName = (index?: number) => (index === undefined ? undefined : THEMES[index]?.name);
