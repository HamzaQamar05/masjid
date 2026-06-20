export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function token() {
  const sessionToken = sessionStorage.getItem('token');
  if (sessionToken) return sessionToken;
  const legacyToken = localStorage.getItem('token');
  if (legacyToken) {
    sessionStorage.setItem('token', legacyToken);
    localStorage.removeItem('token');
  }
  return legacyToken;
}

export function storedUser() {
  const sessionUser = sessionStorage.getItem('user');
  const legacyUser = !sessionUser ? localStorage.getItem('user') : null;
  const saved = sessionUser || legacyUser;
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    if (legacyUser) {
      sessionStorage.setItem('user', legacyUser);
      localStorage.removeItem('user');
    }
    return parsed;
  } catch {
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    return null;
  }
}

export function persistAuth(nextUser, nextToken = token()) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (nextToken) sessionStorage.setItem('token', nextToken);
  if (nextUser) sessionStorage.setItem('user', JSON.stringify(nextUser));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
}
