'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  fetchCurrentUser,
  register,
  login,
  clearStoredUserId,
  type CurrentUser,
} from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Character {
  id: string;
  name: string;
  species: string | null;
  race: string | null;
  gender: string | null;
  traits: string[];
  worldId: string;
}

interface WorldInfo {
  id: string;
  name: string;
  slug: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1.1rem' };
const labelStyle: React.CSSProperties = { color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' };
const inputStyle: React.CSSProperties = { width: '100%', fontSize: '0.9rem' };
const sectionHead: React.CSSProperties = { color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 0.75rem' };
const primaryBtn: React.CSSProperties = { background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.55rem 1.5rem', fontSize: '0.9rem', width: '100%' };
const ghostBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.85rem', padding: 0 };

// ── Auth form ─────────────────────────────────────────────────────────────────

function AuthForm({ onAuth }: { onAuth: (user: CurrentUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === 'register'
          ? await register(username, email, password)
          : await login(email, password);
      if (result.error) {
        setError(result.error);
      } else {
        onAuth(result.user);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      <h2 style={{ color: 'var(--accent)', margin: '0 0 0.25rem' }}>
        {mode === 'register' ? 'Create Account' : 'Sign In'}
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        {mode === 'register'
          ? 'Create a player account to build characters and explore worlds.'
          : 'Welcome back.'}
      </p>

      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Username</label>
            <input
              required
              style={inputStyle}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="yourname"
              autoComplete="username"
            />
          </div>
        )}

        <div style={fieldStyle}>
          <label style={labelStyle}>Email</label>
          <input
            required
            type="email"
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Password</label>
          <input
            required
            type="password"
            style={inputStyle}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={6}
          />
        </div>

        {error && (
          <p style={{ color: 'var(--error)', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{error}</p>
        )}

        <button type="submit" disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.6 : 1 }}>
          {submitting
            ? mode === 'register' ? 'Creating…' : 'Signing in…'
            : mode === 'register' ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '1.25rem', textAlign: 'center' }}>
        {mode === 'register' ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button style={ghostBtn} onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setError(null); }}>
          {mode === 'register' ? 'Sign in' : 'Register'}
        </button>
      </p>
    </div>
  );
}

// ── Profile view ──────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [user, setUser] = useState<CurrentUser | null | 'loading'>('loading');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [worlds, setWorlds] = useState<Record<string, WorldInfo>>({});

  useEffect(() => {
    fetchCurrentUser().then((u) => {
      setUser(u);
      if (u) {
        setBio(u.profile?.bio ?? '');
        setAvatarUrl(u.profile?.avatarUrl ?? '');
        loadCharacters(u.id);
      }
    });
  }, []);

  function loadCharacters(userId: string) {
    fetch(`${API}/api/characters?userId=${userId}`)
      .then((r) => r.json())
      .then(async ({ characters: chars }: { characters: Character[] }) => {
        setCharacters(chars ?? []);
        const ids = [...new Set((chars ?? []).map((c) => c.worldId))];
        const worldsRes = await fetch(`${API}/api/worlds`).then((r) => r.json()) as { worlds: WorldInfo[] };
        const map: Record<string, WorldInfo> = {};
        for (const w of worldsRes.worlds ?? []) {
          if (ids.includes(w.id)) map[w.id] = w;
        }
        setWorlds(map);
      })
      .catch(console.error);
  }

  async function saveProfile() {
    if (!user || user === 'loading') return;
    setSaving(true);
    try {
      await fetch(`${API}/api/auth/users/${user.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bio || null, avatarUrl: avatarUrl || null }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function handleAuth(u: CurrentUser) {
    setUser(u);
    setBio(u.profile?.bio ?? '');
    setAvatarUrl(u.profile?.avatarUrl ?? '');
    loadCharacters(u.id);
  }

  function handleSignOut() {
    clearStoredUserId();
    setUser(null);
    setCharacters([]);
  }

  // Loading state
  if (user === 'loading') {
    return (
      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </main>
    );
  }

  // Not logged in — show auth form
  if (!user) {
    return (
      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>← Home</Link>
        <div style={{ marginTop: '2.5rem' }}>
          <AuthForm onAuth={handleAuth} />
        </div>
      </main>
    );
  }

  // Logged in
  const byWorld = characters.reduce<Record<string, Character[]>>((acc, c) => {
    (acc[c.worldId] ??= []).push(c);
    return acc;
  }, {});

  return (
    <main style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Link href="/worlds" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>← Worlds</Link>
        <button onClick={handleSignOut} style={{ ...ghostBtn, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Sign out
        </button>
      </div>

      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2rem' }}>
        <div
          style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'var(--accent-dim)', border: '2px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', flexShrink: 0, overflow: 'hidden',
          }}
        >
          {avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : user.username[0].toUpperCase()}
        </div>
        <div>
          <div style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '1.1rem' }}>{user.username}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{user.email}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            {user.role.toLowerCase()} · joined {new Date(user.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Profile edit */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={sectionHead}>Profile</h3>

        <div style={fieldStyle}>
          <label style={labelStyle}>Bio</label>
          <textarea
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A few words about yourself…"
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Avatar URL</label>
          <input
            type="url"
            style={inputStyle}
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        <button
          onClick={saveProfile}
          disabled={saving}
          style={{
            background: saved ? 'var(--success)' : 'var(--accent)',
            color: '#fff', border: 'none', borderRadius: '4px',
            padding: '0.5rem 1.5rem', fontSize: '0.9rem',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save Profile'}
        </button>
      </section>

      {/* Characters */}
      <section>
        <h3 style={sectionHead}>Characters ({characters.length})</h3>
        {characters.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No characters yet.{' '}
            <Link href="/worlds" style={{ color: 'var(--accent)' }}>Enter a world to create one.</Link>
          </p>
        )}
        {Object.entries(byWorld).map(([worldId, chars]) => {
          const world = worlds[worldId];
          return (
            <div key={worldId} style={{ marginBottom: '1.5rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                {world
                  ? <Link href={`/worlds/${world.slug}`} style={{ color: 'var(--text-muted)' }}>{world.name}</Link>
                  : worldId}
              </div>
              {chars.map((c) => (
                <div key={c.id} style={{ borderLeft: '2px solid var(--border)', paddingLeft: '1rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div>
                    <div style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{c.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {[c.species, c.race, c.gender].filter(Boolean).join(' · ') || 'No details yet'}
                    </div>
                    {c.traits.length > 0 && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                        {c.traits.slice(0, 4).join(', ')}
                      </div>
                    )}
                  </div>
                  {world && (
                    <Link
                      href={`/worlds/${world.slug}/characters?characterId=${c.id}`}
                      style={{ fontSize: '0.8rem', color: 'var(--accent)', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      Embody →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </section>
    </main>
  );
}
