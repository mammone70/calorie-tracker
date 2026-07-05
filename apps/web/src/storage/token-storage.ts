import type { TokenStorage } from '@calorie-tracker/client';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_ID_KEY = 'user_id';
const USER_ROLE_KEY = 'user_role';
const USER_EMAIL_KEY = 'user_email';

export const localStorageTokenStorage: TokenStorage = {
  async getAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  async getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  async getUserId() {
    return localStorage.getItem(USER_ID_KEY);
  },

  async getUserRole() {
    const role = localStorage.getItem(USER_ROLE_KEY);
    return role === 'admin' || role === 'client' ? role : null;
  },

  async getUserEmail() {
    return localStorage.getItem(USER_EMAIL_KEY);
  },

  async setTokens(accessToken, refreshToken, user) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    if (user?.id) localStorage.setItem(USER_ID_KEY, user.id);
    if (user?.role) localStorage.setItem(USER_ROLE_KEY, user.role);
    if (user?.email) localStorage.setItem(USER_EMAIL_KEY, user.email);
  },

  async clearTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_ROLE_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
  },
};
