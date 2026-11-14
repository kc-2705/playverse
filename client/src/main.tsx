import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider } from 'antd';
import { AuthProvider } from './auth/AuthContext';
import App from './App';
import { playverseTheme } from './theme';
import './styles.css';
import { wakeServer } from './api/client';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConfigProvider theme={playverseTheme}>
          <AntApp>
            <AuthProvider>
              <App />
            </AuthProvider>
          </AntApp>
        </ConfigProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

// Installable app: the service worker caches game files (production builds only).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

// Wake the game server right away, so it's ready by the time anyone needs it.
wakeServer();

// The opening animation lives in index.html so it shows before any script
// loads. Let it play its course, then fade it out.
const intro = document.getElementById('intro');
if (intro) {
  const shownAt = Number(intro.dataset.start || performance.now());
  const minMs = intro.classList.contains('quick') ? 300 : 2100;
  window.setTimeout(() => {
    intro.classList.add('done');
    window.setTimeout(() => intro.remove(), 600);
  }, Math.max(0, minMs - (performance.now() - shownAt)));
}
