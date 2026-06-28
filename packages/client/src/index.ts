import { ApiClient } from './api-client';
import { createLocalStore } from './local-store';
import { createSyncEngine } from './sync';
import { createHooks } from './hooks';
import type { LocalDatabase, TokenStorage } from './types';

export type CalorieTrackerClient = {
  api: ApiClient;
  sync: ReturnType<typeof createSyncEngine>;
  localStore: ReturnType<typeof createLocalStore>;
  hooks: ReturnType<typeof createHooks>;
};

export function createCalorieTrackerClient(
  tokenStorage: TokenStorage,
  localDatabase: LocalDatabase,
  apiUrl: string,
): CalorieTrackerClient {
  const api = new ApiClient(tokenStorage, apiUrl);
  const sync = createSyncEngine(api, localDatabase);
  const localStore = createLocalStore(api, localDatabase, sync);
  const hooks = createHooks(api, localStore);

  return { api, sync, localStore, hooks };
}

export { ApiClient } from './api-client';
export { createSyncEngine } from './sync';
export { createLocalStore } from './local-store';
export { createHooks } from './hooks';
export * from './types';
export * from './utils';
