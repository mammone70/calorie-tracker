import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, sync } from '../lib/client';

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  isOnline: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sync: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    api.init().then(() => {
      setIsAuthenticated(api.isAuthenticated());
      setIsLoading(false);
      if (api.isAuthenticated()) {
        sync.runSync().catch(() => undefined);
      }
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
    await api.setTokens(result.accessToken, result.refreshToken, result.user.id);
    setIsAuthenticated(true);
    await sync.runSync();
  };

  const register = async (email: string, password: string) => {
    const result = await api.register(email, password);
    await api.setTokens(result.accessToken, result.refreshToken, result.user.id);
    setIsAuthenticated(true);
    await sync.runSync();
  };

  const logout = async () => {
    await api.clearTokens();
    setIsAuthenticated(false);
  };

  const runSync = async () => {
    await sync.runSync();
  };

  return (
    <AuthContext.Provider
      value={{ isLoading, isAuthenticated, isOnline, login, register, logout, sync: runSync }}
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
