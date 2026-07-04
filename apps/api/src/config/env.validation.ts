const DEV_JWT_SECRETS = new Set([
  'dev-access-secret',
  'dev-refresh-secret',
  'change-me-access-secret-min-32-chars-long',
  'change-me-refresh-secret-min-32-chars-long',
]);

export function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  const webOrigin = process.env.WEB_ORIGIN;
  const databaseUrl = process.env.DATABASE_URL;

  const errors: string[] = [];

  if (!accessSecret || accessSecret.length < 32 || DEV_JWT_SECRETS.has(accessSecret)) {
    errors.push('JWT_ACCESS_SECRET must be set to a unique value of at least 32 characters');
  }

  if (!refreshSecret || refreshSecret.length < 32 || DEV_JWT_SECRETS.has(refreshSecret)) {
    errors.push('JWT_REFRESH_SECRET must be set to a unique value of at least 32 characters');
  }

  if (!webOrigin || !webOrigin.startsWith('https://')) {
    errors.push('WEB_ORIGIN must be set to your HTTPS production URL');
  }

  if (!databaseUrl) {
    errors.push('DATABASE_URL must be set');
  }

  if (errors.length > 0) {
    throw new Error(`Production environment validation failed:\n- ${errors.join('\n- ')}`);
  }
}

export function getJwtAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32 || DEV_JWT_SECRETS.has(secret)) {
      throw new Error('JWT_ACCESS_SECRET is not configured for production');
    }
    return secret;
  }
  return secret ?? 'dev-access-secret';
}

export function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32 || DEV_JWT_SECRETS.has(secret)) {
      throw new Error('JWT_REFRESH_SECRET is not configured for production');
    }
    return secret;
  }
  return secret ?? 'dev-refresh-secret';
}

export function isRegistrationAllowed(): boolean {
  const value = process.env.ALLOW_REGISTRATION?.toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}
