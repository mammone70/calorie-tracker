import type { TokenStorage } from './types';

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

export class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private userId: string | null = null;

  constructor(
    private readonly tokenStorage: TokenStorage,
    private readonly apiUrl: string,
  ) {}

  async init() {
    this.accessToken = await this.tokenStorage.getAccessToken();
    this.refreshToken = await this.tokenStorage.getRefreshToken();
    this.userId = await this.tokenStorage.getUserId();
  }

  getUserId() {
    return this.userId;
  }

  async setTokens(accessToken: string, refreshToken: string, userId?: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (userId) this.userId = userId;
    await this.tokenStorage.setTokens(accessToken, refreshToken, userId);
  }

  async clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    await this.tokenStorage.clearTokens();
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

    const res = await fetch(`${this.apiUrl}${path}`, {
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
    }
  }

  register(email: string, password: string) {
    return this.request<{
      user: { id: string; email: string };
      accessToken: string;
      refreshToken: string;
    }>('/auth/register', { method: 'POST', body: { email, password }, auth: false });
  }

  login(email: string, password: string) {
    return this.request<{
      user: { id: string; email: string };
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', { method: 'POST', body: { email, password }, auth: false });
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

  getEffectiveMealPlans(date: string) {
    return this.request(`/meal-plans/effective?date=${date}`);
  }

  materializeWeeklyMealPlan(date: string) {
    return this.request('/meal-plans/materialize-weekly', { method: 'POST', body: { date } });
  }

  resetMealPlanToWeekly(date: string) {
    return this.request('/meal-plans/reset-to-weekly', { method: 'POST', body: { date } });
  }

  createMealPlan(body: unknown) {
    return this.request('/meal-plans', { method: 'POST', body });
  }

  deleteMealPlan(id: string) {
    return this.request(`/meal-plans/${id}`, { method: 'DELETE' });
  }

  getWeeklyMeals(dayOfWeek?: number) {
    const query = dayOfWeek !== undefined ? `?dayOfWeek=${dayOfWeek}` : '';
    return this.request(`/weekly-meals${query}`);
  }

  setWeeklyMealCount(body: unknown) {
    return this.request('/weekly-meals/set-count', { method: 'POST', body });
  }

  updateWeeklyMeal(id: string, body: unknown) {
    return this.request(`/weekly-meals/${id}`, { method: 'PATCH', body });
  }

  getWeeklyMealPlans(dayOfWeek?: number) {
    const query = dayOfWeek !== undefined ? `?dayOfWeek=${dayOfWeek}` : '';
    return this.request(`/weekly-meal-plans${query}`);
  }

  createWeeklyMealPlan(body: unknown) {
    return this.request('/weekly-meal-plans', { method: 'POST', body });
  }

  deleteWeeklyMealPlan(id: string) {
    return this.request(`/weekly-meal-plans/${id}`, { method: 'DELETE' });
  }

  getFoodLogs(date: string) {
    return this.request(`/food-logs?date=${date}`);
  }

  materializeFoodLogsFromPlan(date: string) {
    return this.request('/food-logs/materialize-from-plan', { method: 'POST', body: { date } });
  }

  confirmFoodLog(id: string) {
    return this.request(`/food-logs/${id}/confirm`, { method: 'PATCH' });
  }

  updateFoodLog(id: string, body: unknown) {
    return this.request(`/food-logs/${id}`, { method: 'PATCH', body });
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
