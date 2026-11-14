import type { Meta, StoryObj } from '@storybook/react-vite';
import TopRunners from './TopRunners';
import { sampleRows } from '../../.storybook/mockApi';

const meta = {
  title: 'Players/TopRunners',
  component: TopRunners,
  decorators: [(Story) => <div style={{ maxWidth: 340 }}><Story /></div>],
} satisfies Meta<typeof TopRunners>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Shows the top five, even when more players are sent. */
export const WithRunners: Story = { args: { rows: sampleRows(() => ({})) } };

/** Skeleton while the leaderboard loads (or the free server wakes up). */
export const Loading: Story = { args: { loading: true } };

/** Nobody has played this week yet. */
export const Empty: Story = { args: { rows: [] } };
