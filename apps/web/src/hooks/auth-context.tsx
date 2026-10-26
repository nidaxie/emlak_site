import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  setAccessToken,
  setRefreshedHandler,
  setUnauthorizedHandler,
} from '@/lib/api-client';
import { authApi } from '@/services/api';
import type { AuthUser, LoginRequest } from '@/types/api';

type AuthValue = {
  user: AuthUser | null;
  ready: boolean;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const queryClient = useQueryClient();
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    let live = true;
    setUnauthorizedHandler(() => {
      if (live) {
        setUser(null);
        setAccessToken(null);
        queryClient.clear();
      }
    });
    setRefreshedHandler((refreshedUser) => {
      if (live) {
        const next = refreshedUser as AuthUser;
        if (
          userRef.current &&
          (userRef.current.id !== next.id || userRef.current.role !== next.role)
        ) {
          queryClient.clear();
        }
        setUser(next);
      }
    });
    setAccessToken(null);
    setUser(null);
    setReady(true);
    return () => {
      live = false;
      setUnauthorizedHandler(null);
      setRefreshedHandler(null);
    };
  }, [queryClient]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      login: async (data) => {
        const res = await authApi.login(data);
        setAccessToken(res.accessToken);
        setUser(res.user);
        queryClient.clear();
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          setAccessToken(null);
          setUser(null);
          queryClient.clear();
        }
      },
    }),
    [user, ready, queryClient],
  );

  return (
    <AuthContext.Provider value={value}>
      {ready ? (
        children
      ) : (
        <div className="min-h-[100dvh] bg-[#f4f3ed] p-6">
          <div className="mx-auto max-w-6xl">
            <div className="skeleton h-14 w-44" />
            <div className="mt-12 skeleton h-72 rounded-3xl" />
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider bulunamadı');
  return value;
}
