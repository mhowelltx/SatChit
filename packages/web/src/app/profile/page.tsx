'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UserProfile {
  bio: string | null;
  avatarUrl: string | null;
}

interface Character {
  id: string;
  name: string;
  species: string | null;
  race: string | null;
  gender: string | null;
  traits: string[];
  worldId: string;
}

interface CurrentUser {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  profile: UserProfile | null;
}

interface WorldInfo {
  id: string;
  name: string;
  slug: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const field: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  marginBottom: '1.25rem',
};
const label: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
};
const input: React.CSSProperties = { width: '100%', fontSize: '0.9rem' };
const sectionHead: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  margin: '0 0 0.75rem',
};

export default function ProfilePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [worlds, setWorlds] = useState<Record<string, WorldInfo>>({});

  useEffect(() => {
    fetch(`${API}/api/auth/me`)
      .then((r) => r.json())
      .then(({ user: u }: { user: CurrentUser }) => {
        setUser(u);
        setBio(u.profile?.bio ?? '');
        setAvatarUrl(u.profile?.avatarUrl ?? '');
        return fetch(`${API}/api/characters?userId=${u.id}`);
      })
      .then((r) => r.json())
      .then(({ characters: chars }: { characters: Character[] }) => {
        setCharacters(chars ?? []);
        // Fetch world names for each unique worldId
        const ids = [...new Set(chars.map((c) => c.worldId))];
        return Promise.all(
          ids.map((id) =>
            fetch(`${API}/api/worlds`).then((r) => r.json()).then((d: { worlds: WorldInfo[] }) =>
              d.worlds.find((w) => w.id === id),
            )
          )
        );
      })
      .then((results) => {
        const map: Record<string, WorldInfo> = {};
        for (const w of results) {
          if (w) map[w.id] = w;
        }
        setWorlds(map);
      })
      .catch(console.error);
  }, []);

  async function saveProfile() {
    if (!user) return;
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

  if (!user) {
    return (
      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </main>
    );
  }

  // Group characters by world
  const byWorld = characters.reduce<Record<string, Character[]>>((acc, c) => {
    (acc[c.worldId] ??= []).push(c);
    return acc;
  }, {});

  return (
    <main style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem' }}>
      <Link href="/worlds" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        ← Worlds
      </Link>

      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', margin: '1.5rem 0 2rem' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--accent-dim)',
            border: '2px solid var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            user.username[0].toUpperCase()
          )}
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

        <div style={field}>
          <label style={label}>Bio</label>
          <textarea
            rows={3}
            style={{ ...input, resize: 'vertical' }}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="A few words about yourself…"
          />
        </div>

        <div style={field}>
          <label style={label}>Avatar URL</label>
          <input
            type="url"
            style={input}
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
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem 1.5rem',
            fontSize: '0.9rem',
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
            <Link href="/worlds" style={{ color: 'var(--accent)' }}>
              Enter a world to create one.
            </Link>
          </p>
        )}
        {Object.entries(byWorld).map(([worldId, chars]) => {
          const world = worlds[worldId];
          return (
            <div key={worldId} style={{ marginBottom: '1.5rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                {world ? (
                  <Link href={`/worlds/${world.slug}`} style={{ color: 'var(--text-muted)' }}>
                    {world.name}
                  </Link>
                ) : (
                  worldId
                )}
              </div>
              {chars.map((c) => (
                <div
                  key={c.id}
                  style={{
                    borderLeft: '2px solid var(--border)',
                    paddingLeft: '1rem',
                    marginBottom: '0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{c.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {[c.species, c.race, c.gender].filter(Boolean).join(' · ') || 'No details yet'}
                    </div>
                    {c.traits.length > 0 && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        {c.traits.slice(0, 4).join(', ')}
                      </div>
                    )}
                  </div>
                  {world && (
                    <Link
                      href={`/worlds/${world.slug}/characters?characterId=${c.id}`}
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--accent)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
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
