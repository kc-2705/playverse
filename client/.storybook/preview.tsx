import { useState, type ReactNode } from 'react';
import type { Preview } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import { AuthProvider } from '../src/auth/AuthContext';
import { api, tokenStore } from '../src/api/client';
import { playverseTheme } from '../src/theme';
import { DEMO_USER, mockAdapter, type Routes } from './mockApi';
import '../src/styles.css';

/** Wraps every story in the same providers the app uses, with a mocked game server. */
function AppProviders({ signedIn, routes, children }: { signedIn: boolean; routes?: Routes; children: ReactNode }) {
  api.defaults.adapter = mockAdapter({ 'GET /auth/me': { user: DEMO_USER }, ...routes });
  try {
    if (signedIn) tokenStore.set('storybook-token');
    else tokenStore.clear();
  } catch {
    // Storage blocked: stories show the signed-out state.
  }
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ConfigProvider theme={playverseTheme}>
          <AntApp>
            <AuthProvider key={String(signedIn)}>{children}</AuthProvider>
          </AntApp>
        </ConfigProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const preview: Preview = {
  decorators: [
    (Story, { parameters }) => (
      <AppProviders signedIn={Boolean(parameters.signedIn)} routes={parameters.api}>
        <Story />
      </AppProviders>
    ),
  ],
  parameters: {
    layout: 'padded',
    backgrounds: { disable: true },
    a11y: { test: 'error' },
    options: { storySort: { order: ['Introduction', 'Foundations', 'Games', 'Players', 'Account', 'Layout'] } },
  },
  tags: ['autodocs'],
};

export default preview;
