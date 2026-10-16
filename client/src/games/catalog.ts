export interface GameInfo {
  id: string;
  title: string;
  tagline: string;
  description: string;
  modes: string[];
  status: 'play' | 'soon';
  cover: string; // CSS background for the card
  controls?: { action: string; keys: string; touch: string }[];
}

export const GAMES: GameInfo[] = [
  {
    id: 'rooftop-runner',
    title: 'Rooftop Runner',
    tagline: 'Run across rooftops, mountain trails and haunted towns',
    description: 'Sprint, leap the gaps, climb ledges and slide under obstacles while something chases you. Pick a world: City Sunset, Mountain Trail, Green Hills, Old Village or Halloween Night. How far can you get?',
    modes: ['Single player', '5 worlds', 'Leaderboard'],
    status: 'play',
    cover: 'url(/covers/rooftop-runner.png) center / cover, linear-gradient(160deg, #ff9f5a, #5a2d6b)',
    controls: [
      { action: 'Change lanes', keys: '← → or A D', touch: 'Swipe left / right' },
      { action: 'Jump the gaps', keys: '↑ W or Space', touch: 'Swipe up' },
      { action: 'Slide', keys: '↓ or S', touch: 'Swipe down' },
    ],
  },
  {
    id: 'wingsuit-canyon',
    title: 'Wingsuit Canyon',
    tagline: 'Fly fast and low through red-rock canyons',
    description: 'Dive off a cliff in a wingsuit, skim the rocks for bonus points and race your best ghost.',
    modes: ['Single player', 'Ghost race', 'Leaderboard'],
    status: 'play',
    cover: 'url(/covers/wingsuit-canyon.jpg) center / cover, linear-gradient(160deg, #e9905a 0%, #b34a2c 45%, #3b1d2e 100%)',
  },
  {
    id: 'night-heist',
    title: 'Night Heist',
    tagline: 'Steal the painting. Don’t get seen.',
    description: 'Sneak through a museum at night. Dodge lasers, time the cameras, throw coins to distract guards, and get out with the painting.',
    modes: ['Stealth', '3 levels', 'Leaderboard'],
    status: 'play',
    cover: 'url(/covers/night-heist.jpg) center / cover, linear-gradient(160deg, #1b2a4a 0%, #0b1020 60%, #7a1f3d 100%)',
  },
  {
    id: 'ragdoll-arena',
    title: 'Ragdoll Arena',
    tagline: 'Push your friends off the platform',
    description: 'Floppy physics fighters on moving platforms. Up to 4 players on one screen.',
    modes: ['2–4 players', 'vs Computer'],
    status: 'soon',
    cover: 'linear-gradient(160deg, #3a8dde 0%, #6c4ee0 55%, #ff6b8b 100%)',
  },
  {
    id: 'museum-hide-seek',
    title: 'Museum Hide & Seek',
    tagline: 'Become a statue. Don’t move.',
    description: 'One player disguises as a museum object. The others have two minutes to find them. Play with friends over a room code.',
    modes: ['Online multiplayer', '2–8 players', 'Leaderboard'],
    status: 'play',
    cover: 'url(/covers/museum-hide-seek.jpg) center / cover, linear-gradient(160deg, #c9b18a 0%, #6d5a43 55%, #2b2420 100%)',
  },
];

export const gameById = (id: string) => GAMES.find((g) => g.id === id);

export const AVATARS: Record<string, string> = {
  fox: '🦊', owl: '🦉', cat: '🐱', panda: '🐼', tiger: '🐯', koala: '🐨', wolf: '🐺', frog: '🐸',
};
