import * as SecureStore from 'expo-secure-store';
import { API_URL } from './utils';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_ID_KEY = 'user_id';

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private userId: string | null = null;
  private refreshPromise: Promise<boolean> | null = null;

  async init() {
    this.accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    this.refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    this.userId = await SecureStore.getItemAsync(USER_ID_KEY);
  }

  getUserId() {
    return this.userId;
  }

  async setTokens(accessToken: string, refreshToken: string, userId?: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (userId) this.userId = userId;
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    if (userId) await SecureStore.setItemAsync(USER_ID_KEY, userId);
  }

  async clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_ID_KEY);
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.auth !== false && this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 401 && this.refreshToken && options.auth !== false) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        return this.request(path, options);
      }
    }

    if (!res.ok) {
      const error = await res.text();
      throw new Error(error || `Request failed: ${res.status}`);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  private async tryRefresh() {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const data = await this.request<{ accessToken: string; refreshToken: string }>(
          '/auth/refresh',
          {
            method: 'POST',
            body: { refreshToken: this.refreshToken },
            auth: false,
          },
        );
        await this.setTokens(data.accessToken, data.refreshToken);
        return true;
      } catch {
        await this.clearTokens();
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  register(email: string, password: string, trustedDevice = true) {
    return this.request<{ user: { id: string; email: string }; accessToken: string; refreshToken: string }>(
      '/auth/register',
      { method: 'POST', body: { email, password, trustedDevice }, auth: false },
    );
  }

  login(email: string, password: string, trustedDevice = true) {
    return this.request<{ user: { id: string; email: string }; accessToken: string; refreshToken: string }>(
      '/auth/login',
      { method: 'POST', body: { email, password, trustedDevice }, auth: false },
    );
  }

  getMacroTargets(from: string, to: string) {
    return this.request(`/macro-targets?from=${from}&to=${to}`);
  }

  getEffectiveMacroTargets(from: string, to: string) {
    return this.request(`/macro-targets/effective?from=${from}&to=${to}`);
  }

  upsertMacroTarget(body: unknown) {
    return this.request('/macro-targets', { method: 'PUT', body });
  }

  deleteMacroTarget(id: string) {
    return this.request(`/macro-targets/${id}`, { method: 'DELETE' });
  }

  getWeeklyMacroTargets() {
    return this.request('/weekly-macro-targets');
  }

  upsertWeeklyMacroTarget(body: unknown) {
    return this.request('/weekly-macro-targets', { method: 'PUT', body });
  }

  getFoods() {
    return this.request('/foods');
  }

  searchFoods(q: string) {
    return this.request(`/foods/search?q=${encodeURIComponent(q)}`);
  }

  createFood(body: unknown) {
    return this.request('/foods', { method: 'POST', body });
  }

  getMealPlans(date: string) {
    return this.request(`/meal-plans?date=${date}`);
  }

  createMealPlan(body: unknown) {
    return this.request('/meal-plans', { method: 'POST', body });
  }

  deleteMealPlan(id: string) {
    return this.request(`/meal-plans/${id}`, { method: 'DELETE' });
  }

  getFoodLogs(date: string) {
    return this.request(`/food-logs?date=${date}`);
  }

  createFoodLog(body: unknown) {
    return this.request('/food-logs', { method: 'POST', body });
  }

  deleteFoodLog(id: string) {
    return this.request(`/food-logs/${id}`, { method: 'DELETE' });
  }

  syncPull(since?: string) {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    return this.request(`/sync${query}`);
  }

  syncPush(mutations: unknown[]) {
    return this.request('/sync/push', { method: 'POST', body: { mutations } });
  }
}

export const api = new ApiClient();
