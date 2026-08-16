/**
 * Centralized API configuration and fetch helper for backend communication.
 * Prevents 405 Method Not Allowed errors when VITE_BACKEND_URL is undefined.
 */

export const BACKEND_URL: string = (
  import.meta.env.VITE_BACKEND_URL ||
  'https://polis-polishub.8vsz2a.easypanel.host'
).replace(/\/$/, '');

export const apiFetch = async (pathOrUrl: string, options: RequestInit = {}): Promise<Response> => {
  const secret = import.meta.env.VITE_WEBHOOK_SECRET as string | undefined;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (secret) {
    headers['x-webhook-secret'] = secret;
  }

  const finalUrl = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `${BACKEND_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;

  return fetch(finalUrl, { ...options, headers });
};
