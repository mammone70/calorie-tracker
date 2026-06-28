import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { api } from '../lib/api';
import { runSync } from '../lib/sync';

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  sync: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    api.init().then(() => {
      setIsAuthenticated(api.isAuthenticated());
      setIsLoading(false);
      if (api.isAuthenticated()) {
        runSync().catch(() => undefined);
      }
    });

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && api.isAuthenticated()) {
        runSync().catch(() => undefined);
      }
    });

    return () => sub.remove();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password);
    await api.setTokens(result.accessToken, result.refreshToken, result.user.id);
    setIsAuthenticated(true);
    await runSync();
  };

  const register = async (email: string, password: string) => {
    const result = await api.register(email, password);
    await api.setTokens(result.accessToken, result.refreshToken, result.user.id);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await api.clearTokens();
    setIsAuthenticated(false);
  };

  const sync = async () => {
    await runSync();
  };

  return (
    <AuthContext.Provider
      value={{ isLoading, isAuthenticated, login, register, logout, sync }}
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
