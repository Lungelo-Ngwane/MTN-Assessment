import { QueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createApi, type AccessToken } from '@/api/client';

type Session = {
  key: number;
  email: string;
  controller: AbortController;
  queryClient: QueryClient;
  api: ReturnType<typeof createApi>;
  expiresAt: number;
};
type Auth = {
  session: Session | null;
  expired: boolean;
  signIn: (token: AccessToken, email: string) => void;
  signOut: () => void;
};
const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const active = useRef<Session | null>(null);
  const nextKey = useRef(0);
  const [session, setSession] = useState<Session | null>(null);
  const [expired, setExpired] = useState(false);

  function signOut(wasExpired = false) {
    const current = active.current;
    active.current = null;
    current?.controller.abort();
    current?.queryClient.clear();
    setSession(null);
    setExpired(wasExpired);
  }

  function signIn(token: AccessToken, email: string) {
    signOut();
    const key = ++nextKey.current;
    const controller = new AbortController();
    const current = {
      key,
      email,
      controller,
      expiresAt: Date.now() + token.expiresIn * 1000,
      queryClient: new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      }),
      api: createApi({
        token: token.accessToken,
        signal: controller.signal,
        expired: () => {
          if (active.current?.key === key) signOut(true);
        },
      }),
    };
    active.current = current;
    setSession(current);
  }

  useEffect(() => {
    if (!session) return;
    const expire = () => {
      if (active.current?.key === session.key) signOut(true);
    };
    const timer = window.setTimeout(
      expire,
      Math.max(0, session.expiresAt - Date.now()),
    );
    const check = () => {
      if (Date.now() >= session.expiresAt) expire();
    };
    window.addEventListener('focus', check);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', check);
    };
  }, [session]);

  return (
    <AuthContext.Provider
      value={{ session, expired, signIn, signOut: () => signOut() }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('Authentication provider is missing');
  return auth;
}

export function useSession() {
  const { session } = useAuth();
  if (!session) throw new Error('A session is required');
  return session;
}
