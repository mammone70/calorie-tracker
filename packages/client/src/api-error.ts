type NestErrorBody = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function parseApiError(raw: string, status: number): string {
  let parsed: NestErrorBody | null = null;

  try {
    parsed = JSON.parse(raw) as NestErrorBody;
  } catch {
    // Response body is not JSON.
  }

  if (parsed?.message) {
    const message = Array.isArray(parsed.message)
      ? parsed.message.join(', ')
      : parsed.message;
    if (message && message !== 'Internal server error') {
      return message;
    }
  }

  switch (status) {
    case 400:
      return 'Please check your input and try again.';
    case 401:
      return 'Invalid email or password.';
    case 403:
      return 'You do not have permission to do that.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return typeof parsed?.message === 'string'
        ? parsed.message
        : 'That resource already exists.';
    case 429:
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      if (status >= 500) {
        return 'Something went wrong on our end. Please try again later.';
      }
      return 'Something went wrong. Please try again.';
  }
}
