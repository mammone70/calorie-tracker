import { toast } from 'sonner';

export function showError(message: string) {
  toast.error(message);
}

export function showSuccess(message: string) {
  toast.success(message);
}

export function showErrorFromUnknown(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof Error && error.message) {
    showError(error.message);
    return;
  }
  showError(fallback);
}
