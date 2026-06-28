import type { TokenStorage } from '@calorie-tracker/client';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_ID_KEY = 'user_id';

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

  async setTokens(accessToken, refreshToken, userId) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    if (userId) localStorage.setItem(USER_ID_KEY, userId);
  },

  async clearTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
  },
};
