import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { AuthProvider } from './auth/AuthContext';
import App from './App';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConfigProvider
          theme={{
            algorithm: theme.darkAlgorithm,
            token: {
              colorPrimary: '#ff8a3d',
              colorInfo: '#5aa9ff',
              colorBgBase: '#0e1222',
              colorBgContainer: '#151a2e',
              colorBgElevated: '#1b2138',
              colorBorder: '#2a3150',
              borderRadius: 12,
              fontFamily: "'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif",
            },
            components: {
              Button: { fontWeight: 700 },
              Statistic: { contentFontSize: 26 },
            },
          }}
        >
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
