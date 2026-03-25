const KEY = 'satchit_user_id';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface CurrentUser {
  id: string;
  username: string;
  email: string;
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
}

export function clearStoredUserId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const userId = getStoredUserId();
  const url = userId ? `${API}/api/auth/me?userId=${userId}` : `${API}/api/auth/me`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { user: CurrentUser };
    return data.user;
  } catch {
    return null;
  }
}

export type AuthResult = { user: CurrentUser; error: null } | { user: null; error: string };

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { user: null, error: data.error ?? 'Registration failed.' };
    storeUserId(data.user.id);
    return { user: data.user, error: null };
  } catch {
    return { user: null, error: 'Network error.' };
  }
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) return { user: null, error: data.error ?? 'Login failed.' };
    storeUserId(data.user.id);
    return { user: data.user, error: null };
  } catch {
    return { user: null, error: 'Network error.' };
  }
}
