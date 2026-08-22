/**
 * Centralized API Client for EasyDesk
 * Handles CSRF headers, Authorization Bearer tokens, JSON serialization, and error handling.
 */

let cachedCsrfToken: string | null = null;

export async function fetchCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch('/api/security/csrf');
    if (res.ok) {
      const data = await res.json();
      if (data.csrfToken) {
        cachedCsrfToken = data.csrfToken;
        return data.csrfToken;
      }
    }
  } catch (err) {
    console.error('Failed to fetch CSRF token:', err);
  }
  return 'easydesk_secure_csrf_token_2026_val';
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  token?: string;
  isAdmin?: boolean;
  body?: any;
}

export async function apiFetch(endpoint: string, options: RequestOptions = {}): Promise<Response> {
  const { token, isAdmin, headers: customHeaders, body, method = 'GET', ...restOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  // Get Auth Token
  let authToken = token;
  if (!authToken) {
    authToken = localStorage.getItem('easydesk_admin_token') || undefined;
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Include CSRF token for state-changing HTTP methods
  let csrfTokenUsed: string | undefined;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) {
    csrfTokenUsed = await fetchCsrfToken();
    headers['x-csrf-token'] = csrfTokenUsed;
  }

  const config: RequestInit = {
    method,
    headers,
    body: body !== undefined && typeof body !== 'string' ? JSON.stringify(body) : body,
    ...restOptions,
  };

  const response = await fetch(endpoint, config);

  if (!response.ok) {
    const status = response.status;
    let backendError = response.statusText;
    try {
      const cloned = response.clone();
      const errJson = await cloned.json();
      if (errJson && errJson.message) backendError = errJson.message;
    } catch {}

    console.warn(`[EasyDesk API ERROR]
Endpoint: ${endpoint}
Method: ${method}
Status: ${status}
Reason: ${backendError}
Auth Present: ${!!authToken}
CSRF Present: ${!!csrfTokenUsed}
Payload:`, body !== undefined ? body : '(none)');
  }

  return response;
}

export async function adminFetch(endpoint: string, options: RequestOptions = {}): Promise<Response> {
  return apiFetch(endpoint, { ...options, isAdmin: true });
}

export async function apiClient<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const response = await apiFetch(endpoint, options);

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Ignore JSON parse error on non-json error response
    }
    throw new Error(errorMessage);
  }

  // Handle empty or 204 response
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
