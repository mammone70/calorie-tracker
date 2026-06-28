import { createCalorieTrackerClient, type CalorieTrackerClient } from '@calorie-tracker/client';
import { dexieDatabase } from '../db/dexie-db';
import { localStorageTokenStorage } from '../storage/token-storage';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export const client: CalorieTrackerClient = createCalorieTrackerClient(
  localStorageTokenStorage,
  dexieDatabase,
  API_URL,
);

export const { api, sync, localStore, hooks } = client;
