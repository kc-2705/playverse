import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from 'antd';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import AuthModal from './AuthModal';
import { useAuth } from '../auth/AuthContext';
import { DEMO_USER, delay, fail } from '../../.storybook/mockApi';

/** Opens the dialog when the story loads, the way a game does after a run. */
function OpenOnLoad({ reason }: { reason?: string }) {
  const { askToSignIn, user } = useAuth();
  // Open once when the story loads; closing it should keep it closed.
  const [openOnce] = useState(() => () => askToSignIn(reason));
  useEffect(openOnce, [openOnce]);
  return (
    <>
      {user ? <p>Signed in as <b>{user.username}</b></p> : <Button onClick={() => askToSignIn(reason)}>Open sign-in</Button>}
      <AuthModal />
    </>
  );
}

const meta = {
  title: 'Account/AuthModal',
  component: AuthModal,
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, height: '620px' } },
    api: {
      'POST /auth/login': () => delay(700, { token: 't', user: DEMO_USER }),
      'POST /auth/register': () => delay(700, { token: 't', user: DEMO_USER }),
    },
  },
  render: (_, { parameters }) => (
    <div style={{ padding: 24 }}>
      <OpenOnLoad reason={parameters.reason} />
    </div>
  ),
} satisfies Meta<typeof AuthModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);

export const LogIn: Story = {};

/** Opened by a game, with the reason shown above the form. */
export const LogInToSaveScore: Story = { parameters: { reason: 'Log in to save your score' } };

/** Switches to the sign-up form, which asks for a username and email too. */
export const SignUp: Story = {
  play: async () => {
    await userEvent.click(await body().findByText('Sign up'));
    await expect(await body().findByLabelText('Email')).toBeInTheDocument();
  },
};

/** Submitting empty fields shows inline validation messages. */
export const Validation: Story = {
  play: async () => {
    await userEvent.click(await body().findByRole('button', { name: 'Log in' }));
    await expect(await body().findByText('Enter your username or email.')).toBeInTheDocument();
    await expect(await body().findByText('Enter your password.')).toBeInTheDocument();
  },
};

/** The server rejects the password, so its message appears above the form. */
export const WrongPassword: Story = {
  parameters: { api: { 'POST /auth/login': () => delay(600, fail(401, 'Wrong username or password.')) } },
  play: async () => {
    await userEvent.type(await body().findByLabelText('Username or email'), 'kavya');
    await userEvent.type(body().getByLabelText('Password'), 'not-my-password');
    await userEvent.click(body().getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(body().getByText('Wrong username or password.')).toBeInTheDocument(), { timeout: 3000 });
  },
};
