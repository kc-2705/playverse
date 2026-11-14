import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from 'antd';
import LeaderboardTable from './LeaderboardTable';
import { DEMO_USER, sampleRows } from '../../.storybook/mockApi';

const meta = {
  title: 'Players/LeaderboardTable',
  component: LeaderboardTable,
  argTypes: {
    game: { control: 'select', options: ['rooftop-runner', 'wingsuit-canyon', 'night-heist', 'museum-hide-seek'] },
  },
  decorators: [(Story) => <Card styles={{ body: { padding: 0 } }} style={{ maxWidth: 900 }}><Story /></Card>],
} satisfies Meta<typeof LeaderboardTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Top three get crowns. Rooftop Runner shows distance, coins and the world played. */
export const RooftopRunner: Story = {
  args: { game: 'rooftop-runner', rows: sampleRows((i) => ({ distance: 4200 - i * 380, coins: 310 - i * 25, theme: i % 5 })) },
};

export const WingsuitCanyon: Story = {
  args: { game: 'wingsuit-canyon', rows: sampleRows((i) => ({ distance: 6100 - i * 450, rings: 42 - i * 4 })) },
};

export const NightHeist: Story = {
  args: { game: 'night-heist', rows: sampleRows((i) => ({ levels: Math.max(1, 3 - Math.floor(i / 3)), gems: 18 - i * 2 })) },
};

export const MuseumHideAndSeek: Story = {
  args: { game: 'museum-hide-seek', rows: sampleRows((i) => ({ found: Math.max(0, 5 - Math.floor(i / 2)) })) },
};

/** The signed-in player's row is highlighted with a "You" tag. */
export const YourRowHighlighted: Story = {
  args: { ...RooftopRunner.args, game: 'rooftop-runner', rows: RooftopRunner.args!.rows!, currentUserId: DEMO_USER.id },
};

export const Loading: Story = { args: { game: 'rooftop-runner', rows: [], loading: true } };

export const Empty: Story = { args: { game: 'rooftop-runner', rows: [] } };
