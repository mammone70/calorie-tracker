import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@calorie-tracker/shared';
import { api, sync } from '../lib/client';
import { localStorageTokenStorage } from '../storage/token-storage';

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnline: boolean;
  user: User | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, inviteToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  sync: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updatePreferences: (input: { weightUnit: 'lbs' | 'kg' }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    api.init().then(async () => {
      const authenticated = api.isAuthenticated();
      setIsAuthenticated(authenticated);

      if (authenticated) {
        try {
          const me = await api.getMe();
          setUser(me);
          const accessToken = await localStorageTokenStorage.getAccessToken();
          const refreshToken = await localStorageTokenStorage.getRefreshToken();
          if (accessToken && refreshToken) {
            await api.setTokens(accessToken, refreshToken, me);
          }
          sync.runSync().catch(() => undefined);
        } catch {
          await api.clearTokens();
          setIsAuthenticated(false);
          setUser(null);
        }
      }

      setIsLoading(false);
    });

    const handleOnline = () => {
      setIsOnline(true);
      if (api.isAuthenticated()) {
        sync.runSync().catch(() => undefined);
      }
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password);
    await api.setTokens(result.accessToken, result.refreshToken, result.user);
    setUser(result.user);
    setIsAuthenticated(true);
    await sync.runSync();
  };

  const register = async (email: string, password: string, inviteToken?: string) => {
    const result = await api.register(email, password, inviteToken);
    await api.setTokens(result.accessToken, result.refreshToken, result.user);
    setUser(result.user);
    setIsAuthenticated(true);
    await sync.runSync();
  };

  const logout = async () => {
    await api.clearTokens();
    setIsAuthenticated(false);
    setUser(null);
  };

  const runSync = async () => {
    await sync.runSync();
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await api.changePassword(currentPassword, newPassword);
    await api.clearTokens();
    setIsAuthenticated(false);
    setUser(null);
  };

  const updatePreferences = async (input: { weightUnit: 'lbs' | 'kg' }) => {
    const updated = await api.updateMe(input);
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated,
        isOnline,
        user,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
        sync: runSync,
        changePassword,
        updatePreferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
