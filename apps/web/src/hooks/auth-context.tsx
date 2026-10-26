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
  getAccessToken,
  refreshSession,
  setAccessToken,
  setRefreshedHandler,
  setUnauthorizedHandler,
  subscribeAccessToken,
} from '@/lib/api-client';
import { isMockDataEnabled } from '@/lib/data-mode';
import { authService } from '@/services/auth';
import type {
  AuthUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  UserProfile,
} from '@/types/api';

type AuthValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  ready: boolean;
  login: (data: LoginRequest) => Promise<LoginResponse>;
  register: (data: RegisterRequest) => Promise<AuthUser>;
  refresh: () => Promise<LoginResponse | null>;
  logout: () => Promise<void>;
  syncUser: (profile: UserProfile) => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(() => getAccessToken());
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    let live = true;

    const unsubscribeToken = subscribeAccessToken((nextToken) => {
      if (live) {
        setTokenState(nextToken);
      }
    });

    setUnauthorizedHandler(() => {
      if (live) {
        setUser(null);
        setTokenState(null);
        queryClient.clear();
      }
    });

    setRefreshedHandler((session) => {
      if (live) {
        const next = session.user;
        if (
          userRef.current &&
          (userRef.current.id !== next.id || userRef.current.role !== next.role)
        ) {
          queryClient.clear();
        }
        setUser(next);
        setTokenState(session.accessToken);
      }
    });

    const cleanup = () => {
      live = false;
      unsubscribeToken();
      setUnauthorizedHandler(null);
      setRefreshedHandler(null);
    };

    if (isMockDataEnabled) {
      setAccessToken(null);
      setUser(null);
      setIsLoading(false);
      return cleanup;
    }

    refreshSession()
      .then((session) => {
        if (!live) return;
        if (session) {
          setUser(session.user);
          setTokenState(session.accessToken);
          queryClient.invalidateQueries();
        } else {
          setUser(null);
          setTokenState(null);
        }
      })
      .finally(() => {
        if (live) {
          setIsLoading(false);
        }
      });

    return cleanup;
  }, [queryClient]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      accessToken: token,
      isAuthenticated: Boolean(user && token),
      isLoading,
      ready: !isLoading,
      login: async (data) => {
        const res = await authService.login(data);
        setAccessToken(res.accessToken);
        setUser(res.user);
        queryClient.clear();
        return res;
      },
      register: async (data) => {
        return authService.register(data);
      },
      refresh: async () => {
        if (isMockDataEnabled) return null;
        return refreshSession();
      },
      logout: async () => {
        try {
          if (!isMockDataEnabled) {
            await authService.logout();
          }
        } finally {
          setAccessToken(null);
          setUser(null);
          queryClient.clear();
        }
      },
      syncUser: (profile) => {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                firstName: profile.firstName,
                lastName: profile.lastName,
                phone: profile.phone,
                email: profile.email,
                role: profile.role,
                isActive: profile.isActive,
              }
            : profile,
        );
      },
    }),
    [user, token, isLoading, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider bulunamadı');
  return value;
}
