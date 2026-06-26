import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function token() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function storedUser() {
  const saved = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}

export function persistAuth(nextUser, nextToken = token()) {
  if (nextToken) {
    localStorage.setItem(TOKEN_KEY, nextToken);
    sessionStorage.setItem(TOKEN_KEY, nextToken);
  }
  if (nextUser) {
    const serialized = JSON.stringify(nextUser);
    localStorage.setItem(USER_KEY, serialized);
    sessionStorage.setItem(USER_KEY, serialized);
  }
  persistNativeAuth(nextUser, nextToken).catch(console.error);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  clearNativeAuth().catch(console.error);
}

export async function hydratePersistentAuth() {
  if (!Capacitor.isNativePlatform() || token()) return storedUser();
  const [{ value: savedToken }, { value: savedUser }] = await Promise.all([
    Preferences.get({ key: TOKEN_KEY }),
    Preferences.get({ key: USER_KEY })
  ]);
  if (savedToken) {
    localStorage.setItem(TOKEN_KEY, savedToken);
    sessionStorage.setItem(TOKEN_KEY, savedToken);
  }
  if (savedUser) {
    localStorage.setItem(USER_KEY, savedUser);
    sessionStorage.setItem(USER_KEY, savedUser);
  }
  return storedUser();
}

async function persistNativeAuth(nextUser, nextToken) {
  if (!Capacitor.isNativePlatform()) return;
  const writes = [];
  if (nextToken) writes.push(Preferences.set({ key: TOKEN_KEY, value: nextToken }));
  if (nextUser) writes.push(Preferences.set({ key: USER_KEY, value: JSON.stringify(nextUser) }));
  await Promise.all(writes);
}

async function clearNativeAuth() {
  if (!Capacitor.isNativePlatform()) return;
  await Promise.all([
    Preferences.remove({ key: TOKEN_KEY }),
    Preferences.remove({ key: USER_KEY })
  ]);
}
