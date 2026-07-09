import type { TokenStorage } from './types';
import type { AdminUser, CreateInvitationResponse, Invitation, User, UserRole } from '@calorie-tracker/shared';
import { getClientTimeZone } from '@calorie-tracker/shared';
import { ApiError, parseApiError } from './api-error';

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
};

type ForUserOptions = {
  forUserId?: string;
};

function withForUserId(path: string, forUserId?: string) {
  if (!forUserId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}forUserId=${encodeURIComponent(forUserId)}`;
}

export class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private userId: string | null = null;
  private userRole: UserRole | null = null;
  private userEmail: string | null = null;

  constructor(
    private readonly tokenStorage: TokenStorage,
    private readonly apiUrl: string,
  ) {}

  async init() {
    this.accessToken = await this.tokenStorage.getAccessToken();
    this.refreshToken = await this.tokenStorage.getRefreshToken();
    this.userId = await this.tokenStorage.getUserId();
    this.userRole = await this.tokenStorage.getUserRole();
    this.userEmail = await this.tokenStorage.getUserEmail();
  }

  getUserId() {
    return this.userId;
  }

  getUserRole() {
    return this.userRole;
  }

  getUserEmail() {
    return this.userEmail;
  }

  isAdmin() {
    return this.userRole === 'admin';
  }

  async setTokens(
    accessToken: string,
    refreshToken: string,
    user?: { id: string; role?: UserRole; email?: string },
  ) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (user?.id) this.userId = user.id;
    if (user?.role) this.userRole = user.role;
    if (user?.email) this.userEmail = user.email;
    await this.tokenStorage.setTokens(accessToken, refreshToken, user);
  }

  async clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    this.userRole = null;
    this.userEmail = null;
    await this.tokenStorage.clearTokens();
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-Timezone': getClientTimeZone(),
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
      const errorText = await res.text();
      const message = parseApiError(errorText, res.status);
      throw new ApiError(message, res.status);
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

  getMe() {
    return this.request<User>('/auth/me');
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ ok: true }>('/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
  }

  previewInvite(token: string) {
    return this.request<{ email: string; expiresAt: string }>(
      `/auth/invites/${encodeURIComponent(token)}/preview`,
      { auth: false },
    );
  }

  register(email: string, password: string, inviteToken?: string) {
    return this.request<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/auth/register', {
      method: 'POST',
      body: { email, password, inviteToken },
      auth: false,
    });
  }

  login(email: string, password: string) {
    return this.request<{
      user: User;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', { method: 'POST', body: { email, password }, auth: false });
  }

  listUsers() {
    return this.request<AdminUser[]>('/admin/users');
  }

  createInvitation(email: string) {
    return this.request<CreateInvitationResponse>('/admin/invitations', {
      method: 'POST',
      body: { email },
    });
  }

  listInvitations() {
    return this.request<Invitation[]>('/admin/invitations');
  }

  getMacroTargets(from: string, to: string, options: ForUserOptions = {}) {
    return this.request(withForUserId(`/macro-targets?from=${from}&to=${to}`, options.forUserId));
  }

  getEffectiveMacroTargets(from: string, to: string, options: ForUserOptions = {}) {
    return this.request(
      withForUserId(`/macro-targets/effective?from=${from}&to=${to}`, options.forUserId),
    );
  }

  upsertMacroTarget(body: unknown, options: ForUserOptions = {}) {
    return this.request(withForUserId('/macro-targets', options.forUserId), {
      method: 'PUT',
      body,
    });
  }

  deleteMacroTarget(id: string, options: ForUserOptions = {}) {
    return this.request(withForUserId(`/macro-targets/${id}`, options.forUserId), {
      method: 'DELETE',
    });
  }

  getWeeklyMacroTargets(options: ForUserOptions = {}) {
    return this.request(withForUserId('/weekly-macro-targets', options.forUserId));
  }

  upsertWeeklyMacroTarget(body: unknown, options: ForUserOptions = {}) {
    return this.request(withForUserId('/weekly-macro-targets', options.forUserId), {
      method: 'PUT',
      body,
    });
  }

  getFoods(options: ForUserOptions = {}) {
    return this.request(withForUserId('/foods', options.forUserId));
  }

  searchFoods(q: string) {
    return this.request(`/foods/search?q=${encodeURIComponent(q)}`);
  }

  createFood(body: unknown) {
    return this.request('/foods', { method: 'POST', body });
  }

  getMealPlans(date: string, options: ForUserOptions = {}) {
    return this.request(withForUserId(`/meal-plans?date=${date}`, options.forUserId));
  }

  getEffectiveMealPlans(date: string, options: ForUserOptions = {}) {
    return this.request(withForUserId(`/meal-plans/effective?date=${date}`, options.forUserId));
  }

  materializeWeeklyMealPlan(date: string, options: ForUserOptions = {}) {
    return this.request(withForUserId('/meal-plans/materialize-weekly', options.forUserId), {
      method: 'POST',
      body: { date },
    });
  }

  resetMealPlanToWeekly(date: string, options: ForUserOptions = {}) {
    return this.request(withForUserId('/meal-plans/reset-to-weekly', options.forUserId), {
      method: 'POST',
      body: { date },
    });
  }

  createMealPlan(body: unknown, options: ForUserOptions = {}) {
    return this.request(withForUserId('/meal-plans', options.forUserId), {
      method: 'POST',
      body,
    });
  }

  updateMealPlan(id: string, body: unknown, options: ForUserOptions = {}) {
    return this.request(withForUserId(`/meal-plans/${id}`, options.forUserId), {
      method: 'PATCH',
      body,
    });
  }

  deleteMealPlan(id: string, options: ForUserOptions = {}) {
    return this.request(withForUserId(`/meal-plans/${id}`, options.forUserId), {
      method: 'DELETE',
    });
  }

  getWeeklyMeals(dayOfWeek?: number, options: ForUserOptions = {}) {
    const base =
      dayOfWeek !== undefined ? `/weekly-meals?dayOfWeek=${dayOfWeek}` : '/weekly-meals';
    return this.request(withForUserId(base, options.forUserId));
  }

  setWeeklyMealCount(body: unknown, options: ForUserOptions = {}) {
    return this.request(withForUserId('/weekly-meals/set-count', options.forUserId), {
      method: 'POST',
      body,
    });
  }

  updateWeeklyMeal(id: string, body: unknown, options: ForUserOptions = {}) {
    return this.request(withForUserId(`/weekly-meals/${id}`, options.forUserId), {
      method: 'PATCH',
      body,
    });
  }

  getWeeklyMealPlans(dayOfWeek?: number, options: ForUserOptions = {}) {
    const base =
      dayOfWeek !== undefined ? `/weekly-meal-plans?dayOfWeek=${dayOfWeek}` : '/weekly-meal-plans';
    return this.request(withForUserId(base, options.forUserId));
  }

  createWeeklyMealPlan(body: unknown, options: ForUserOptions = {}) {
    return this.request(withForUserId('/weekly-meal-plans', options.forUserId), {
      method: 'POST',
      body,
    });
  }

  updateWeeklyMealPlan(id: string, body: unknown, options: ForUserOptions = {}) {
    return this.request(withForUserId(`/weekly-meal-plans/${id}`, options.forUserId), {
      method: 'PATCH',
      body,
    });
  }

  deleteWeeklyMealPlan(id: string, options: ForUserOptions = {}) {
    return this.request(withForUserId(`/weekly-meal-plans/${id}`, options.forUserId), {
      method: 'DELETE',
    });
  }

  getFoodLogs(date: string) {
    return this.request(`/food-logs?date=${date}`);
  }

  materializeFoodLogsFromPlan(date: string) {
    return this.request('/food-logs/materialize-from-plan', { method: 'POST', body: { date } });
  }

  syncFutureFoodLogsFromWeeklyTemplate(dayOfWeek: number) {
    return this.request('/food-logs/sync-future-from-weekly', {
      method: 'POST',
      body: { dayOfWeek },
    });
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
