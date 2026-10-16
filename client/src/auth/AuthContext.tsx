import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, tokenStore, type User } from '../api/client';

type Status = 'checking' | 'signedIn' | 'signedOut';
interface AuthValue {
  user: User | null;
  status: Status;
  login: (login: string, password: string) => Promise<void>;
  register: (body: { username: string; email: string; password: string }) => Promise<void>;
  signOut: () => void;
  setUser: (u: User) => void;
  /** Opens the sign-in dialog from anywhere, e.g. "Log in to save your score". */
  askToSignIn: (reason?: string) => void;
  authPrompt: { open: boolean; reason?: string };
  closeAuthPrompt: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>(tokenStore.get() ? 'checking' : 'signedOut');
  const [authPrompt, setAuthPrompt] = useState<{ open: boolean; reason?: string }>({ open: false });

  const signOut = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus('signedOut');
    void qc.invalidateQueries();
  }, [qc]);

  const startSession = useCallback(
    (data: { token: string; user: User }) => {
      tokenStore.set(data.token);
      setUser(data.user);
      setStatus('signedIn');
      setAuthPrompt({ open: false });
      void qc.invalidateQueries();
    },
    [qc],
  );

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get('/auth/me')
      .then((r) => {
        setUser(r.data.user);
        setStatus('signedIn');
      })
      .catch(() => signOut());
  }, [signOut]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      status,
      signOut,
      setUser,
      login: async (login, password) => startSession((await api.post('/auth/login', { login, password })).data),
      register: async (body) => startSession((await api.post('/auth/register', body)).data),
      askToSignIn: (reason) => setAuthPrompt({ open: true, reason }),
      authPrompt,
      closeAuthPrompt: () => setAuthPrompt({ open: false }),
    }),
    [user, status, signOut, startSession, authPrompt],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
