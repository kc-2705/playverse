import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import GameCard from './GameCard';
import { GAMES } from '../games/catalog';

const byId = (id: string) => GAMES.find((g) => g.id === id)!;

const meta = {
  title: 'Games/GameCard',
  component: GameCard,
  args: { game: byId('rooftop-runner'), onPlay: fn() },
  argTypes: { game: { control: 'select', options: GAMES.map((g) => g.id), mapping: Object.fromEntries(GAMES.map((g) => [g.id, g])) } },
  decorators: [(Story) => <div style={{ maxWidth: 320 }}><Story /></div>],
} satisfies Meta<typeof GameCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A playable game. Clicking the card fires onPlay (see the Actions panel). */
export const Playable: Story = {};

export const WingsuitCanyon: Story = { args: { game: byId('wingsuit-canyon') } };

/** Not released yet: no Play button, a "Coming soon" tag, and clicks do nothing. */
export const ComingSoon: Story = { args: { game: byId('ragdoll-arena') } };

/** Every game, laid out as on the home page. */
export const AllGames: Story = {
  parameters: { controls: { disable: true } },
  decorators: [(Story) => <div style={{ maxWidth: 'none', width: 'min(1100px, 100%)' }}><Story /></div>],
  render: (args) => (
    <div className="game-grid">
      {GAMES.map((g) => (
        <GameCard key={g.id} game={g} onPlay={args.onPlay} />
      ))}
    </div>
  ),
};
