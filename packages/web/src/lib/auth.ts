const KEY = 'satchit_user_id';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Custom event dispatched on login/logout so NavBar (and other listeners) stay in sync
const AUTH_EVENT = 'satchit:auth';

export interface CurrentUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
  createdAt: string;
  profile: { bio: string | null; avatarUrl: string | null } | null;
}

export function getStoredUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

export function storeUserId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, id);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function clearStoredUserId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function onAuthChange(handler: () => void): () => void {
  window.addEventListener(AUTH_EVENT, handler);
  return () => window.removeEventListener(AUTH_EVENT, handler);
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const userId = getStoredUserId();
  if (!userId) return null;
  try {
    const res = await fetch(`${API}/api/auth/me?userId=${userId}`);
    if (!res.ok) return null;
    const data = await res.json() as { user: CurrentUser };
    return data.user;
  } catch {
    return null;
  }
}

export type AuthResult = { user: CurrentUser; error: null } | { user: null; error: string };

// Register — username + password only
export async function register(
  username: string,
  password: string,
): Promise<AuthResult> {
  try {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return { user: null, error: data.error ?? 'Registration failed.' };
    storeUserId(data.user.id);
    return { user: data.user, error: null };
  } catch {
    return { user: null, error: 'Network error.' };
  }
}

// Login — username + password
export async function login(
  username: string,
  password: string,
): Promise<AuthResult> {
  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return { user: null, error: data.error ?? 'Login failed.' };
    storeUserId(data.user.id);
    return { user: data.user, error: null };
  } catch {
    return { user: null, error: 'Network error.' };
  }
}
