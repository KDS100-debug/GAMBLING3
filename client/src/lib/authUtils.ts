// Auth utilities for JWT token management and dual authentication support

export function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('authToken', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('authToken');
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  if (token && !isTokenExpired(token)) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  return {
    'Content-Type': 'application/json',
  };
}

export function isOtpAuthenticated(): boolean {
  const token = getAuthToken();
  return token ? !isTokenExpired(token) : false;
}

export function logout(): void {
  removeAuthToken();
  // Force page reload to clear any cached state
  window.location.href = '/otp-login';
}

export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}