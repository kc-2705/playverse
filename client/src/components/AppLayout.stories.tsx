import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route, Routes } from 'react-router-dom';
import AppLayout from './AppLayout';

/** The layout renders the current page in its <Outlet />; this stands in for a page. */
function PagePlaceholder() {
  return (
    <div className="page">
      <h1>Page content</h1>
      <p className="muted">Each page (games, leaderboards, profile) renders here, between the top bar and the footer.</p>
    </div>
  );
}

const meta = {
  title: 'Layout/AppLayout',
  component: AppLayout,
  parameters: { layout: 'fullscreen' },
  render: () => (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="*" element={<PagePlaceholder />} />
      </Route>
    </Routes>
  ),
} satisfies Meta<typeof AppLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Visitors see a Log in button. */
export const SignedOut: Story = {};

/** Signed-in players get a Profile link and an account menu with their avatar. */
export const SignedIn: Story = { parameters: { signedIn: true } };
