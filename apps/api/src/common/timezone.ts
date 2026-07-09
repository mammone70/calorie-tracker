import { resolveTimeZone } from '@calorie-tracker/shared';

export function resolveRequestTimeZone(
  headers: Record<string, string | string[] | undefined>,
): string {
  const raw = headers['x-user-timezone'] ?? headers['X-User-Timezone'];
  const timeZone = Array.isArray(raw) ? raw[0] : raw;
  return resolveTimeZone(timeZone);
}
