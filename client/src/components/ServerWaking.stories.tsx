import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import ServerWaking from './ServerWaking';

/** The app fires "pv:waking" when a request is slow. This story fires it so the notice shows. */
function Waking() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('pv:waking', { detail: true }));
    return () => {
      window.dispatchEvent(new CustomEvent('pv:waking', { detail: false }));
    };
  }, []);
  return null;
}

const meta = {
  title: 'Layout/ServerWaking',
  component: ServerWaking,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ServerWaking>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Shown while the free game server starts up after a quiet spell. */
export const Visible: Story = {
  render: () => (
    <div style={{ minHeight: 140 }}>
      <ServerWaking />
      <Waking />
    </div>
  ),
};
