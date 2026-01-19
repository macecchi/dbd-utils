import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: TwitchUser | null;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  handleCallback: () => boolean;
  refresh: () => Promise<boolean>;
  getAccessToken: () => Promise<string | null>;
}

function decodeJwtPayload(token: string): TwitchUser & { exp: number } {
  const [, payload] = token.split('.');
  return JSON.parse(atob(payload));
}

function isTokenExpired(token: string): boolean {
  try {
    const { exp } = decodeJwtPayload(token);
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      login: () => {
        window.location.href = `${API_URL}/auth/login`;
      },

      logout: () => {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        });
      },

      handleCallback: () => {
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const error = params.get('error');

        if (accessToken || refreshToken || error) {
          window.history.replaceState(null, '', window.location.pathname);
        }

        if (error) {
          console.error('Auth error:', error);
          return false;
        }

        if (accessToken && refreshToken) {
          try {
            const payload = decodeJwtPayload(accessToken);
            set({
              accessToken,
              refreshToken,
              user: {
                id: payload.sub,
                login: payload.login,
                display_name: payload.display_name,
                profile_image_url: payload.profile_image_url,
              },
              isAuthenticated: true,
            });
            return true;
          } catch (e) {
            console.error('Failed to decode token:', e);
            return false;
          }
        }

        return false;
      },

      refresh: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return false;

        if (isTokenExpired(refreshToken)) {
          get().logout();
          return false;
        }

        try {
          const res = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (!res.ok) {
            get().logout();
            return false;
          }

          const data = await res.json();
          set({ accessToken: data.access_token });
          return true;
        } catch {
          return false;
        }
      },

      getAccessToken: async () => {
        const { accessToken, refresh } = get();

        if (!accessToken) return null;

        if (isTokenExpired(accessToken)) {
          const refreshed = await refresh();
          if (!refreshed) return null;
          return get().accessToken;
        }

        return accessToken;
      },
    }),
    {
      name: 'dbd-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
