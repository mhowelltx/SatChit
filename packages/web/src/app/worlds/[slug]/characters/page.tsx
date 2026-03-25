'use client';

import { Suspense, useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { fetchCurrentUser, register, login, type CurrentUser } from '@/lib/auth';

interface World {
  id: string;
  name: string;
  slug: string;
  description: string;
}

interface Character {
  id: string;
  name: string;
  species: string | null;
  race: string | null;
  gender: string | null;
  age: number | null;
  physicalDescription: string | null;
  traits: string[];
  backstory: string | null;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' };
const labelStyle: React.CSSProperties = { color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' };
const inputStyle: React.CSSProperties = { width: '100%', fontSize: '0.9rem' };
const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' };

// ── Inline auth form ──────────────────────────────────────────────────────────

function InlineAuth({ onAuth }: { onAuth: (user: CurrentUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
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
      const result = mode === 'register'
        ? await register(username, email, password)
        : await login(email, password);
      if (result.error !== null) {
        setError(result.error);
      } else {
        onAuth(result.user);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', maxWidth: '380px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        Sign in to create or choose a character.
      </p>
      <form onSubmit={handleSubmit}>
        {mode === 'register' && (
          <div style={fieldStyle}>
            <label style={labelStyle}>Username</label>
            <input required style={inputStyle} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="yourname" />
          </div>
        )}
        <div style={fieldStyle}>
          <label style={labelStyle}>Email</label>
          <input required type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Password</label>
          <input required type="password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} />
        </div>
        {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{error}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            type="submit"
            disabled={submitting}
            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.5rem 1.25rem', fontSize: '0.9rem', opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? '…' : mode === 'register' ? 'Create Account' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.85rem', padding: 0 }}
          >
            {mode === 'login' ? 'Register instead' : 'Sign in instead'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function CharactersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get('characterId');

  const [loading, setLoading] = useState(true);
  const [world, setWorld] = useState<World | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Character form state
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [race, setRace] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [physicalDescription, setPhysicalDescription] = useState('');
  const [traitsInput, setTraitsInput] = useState('');
  const [backstory, setBackstory] = useState('');

  // Load world + current user on mount
  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/worlds/${slug}`).then((r) => r.json()),
      fetchCurrentUser(),
    ])
      .then(([worldData, u]) => {
        setWorld(worldData.world ?? null);
        setUser(u);
        if (u && worldData.world) {
          return loadCharacters(u.id, worldData.world.id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCharacters(userId: string, worldId: string) {
    const res = await fetch(`${API}/api/characters?userId=${userId}&worldId=${worldId}`);
    const { characters: chars } = await res.json() as { characters: Character[] };
    setCharacters(chars ?? []);
    if (preselectedId && chars.find((c) => c.id === preselectedId)) {
      router.push(`/worlds/${slug}/play?characterId=${preselectedId}`);
      return;
    }
    if ((chars ?? []).length === 0) setShowForm(true);
  }

  // Called after inline login/register
  async function handleAuth(u: CurrentUser) {
    setUser(u);
    if (world) await loadCharacters(u.id, world.id);
  }

  async function createCharacter(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !world || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const traits = traitsInput.split(',').map((t) => t.trim()).filter(Boolean);
      const res = await fetch(`${API}/api/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          worldId: world.id,
          name: name.trim(),
          species: species.trim() || null,
          race: race.trim() || null,
          gender: gender.trim() || null,
          age: age ? parseInt(age, 10) : null,
          physicalDescription: physicalDescription.trim() || null,
          traits,
          backstory: backstory.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to create character.'); return; }
      router.push(`/worlds/${slug}/play?characterId=${data.character.id}`);
    } catch {
      setError('Failed to create character.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem' }}>
      <Link href={world ? `/worlds/${slug}` : '/worlds'} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        ← {world?.name ?? 'Worlds'}
      </Link>

      <h1 style={{ color: 'var(--accent)', margin: '1rem 0 0.25rem' }}>Choose Your Character</h1>
      {world && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
          Select an existing character or create a new one to embody in{' '}
          <span style={{ color: 'var(--text)' }}>{world.name}</span>.
        </p>
      )}

      {/* Not signed in — show inline auth */}
      {!user && <InlineAuth onAuth={handleAuth} />}

      {/* Signed in — show characters */}
      {user && (
        <>
          {characters.length > 0 && (
            <section style={{ marginBottom: '2rem' }}>
              {characters.map((c) => (
                <div key={c.id} style={{ borderLeft: '2px solid var(--border)', paddingLeft: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--accent)', fontWeight: 'bold', marginBottom: '0.15rem' }}>{c.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {[c.species, c.race, c.gender, c.age ? `age ${c.age}` : null].filter(Boolean).join(' · ') || 'No details'}
                    </div>
                    {c.physicalDescription && <div style={{ color: 'var(--text)', fontSize: '0.85rem', marginTop: '0.3rem' }}>{c.physicalDescription}</div>}
                    {c.traits.length > 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{c.traits.join(', ')}</div>}
                    {c.backstory && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '0.3rem' }}>{c.backstory}</div>}
                  </div>
                  <button
                    onClick={() => router.push(`/worlds/${slug}/play?characterId=${c.id}`)}
                    style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.45rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    Embody
                  </button>
                </div>
              ))}
            </section>
          )}

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '4px', padding: '0.5rem 1.25rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}
            >
              + Create New Character
            </button>
          )}

          {showForm && (
            <form onSubmit={createCharacter} style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
              <h3 style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 1.25rem' }}>New Character</h3>

              <div style={fieldStyle}>
                <label style={labelStyle}>Name *</label>
                <input required style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Character name" />
              </div>

              <div style={rowStyle}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Species</label>
                  <input style={inputStyle} value={species} onChange={(e) => setSpecies(e.target.value)} placeholder="e.g. Human" />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Race</label>
                  <input style={inputStyle} value={race} onChange={(e) => setRace(e.target.value)} placeholder="e.g. Weaver" />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Gender</label>
                  <input style={inputStyle} value={gender} onChange={(e) => setGender(e.target.value)} placeholder="e.g. Female" />
                </div>
              </div>

              <div style={{ ...rowStyle, gridTemplateColumns: '1fr 2fr' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Age</label>
                  <input type="number" min={0} style={inputStyle} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 28" />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Traits</label>
                  <input style={inputStyle} value={traitsInput} onChange={(e) => setTraitsInput(e.target.value)} placeholder="curious, patient, skeptical (comma-separated)" />
                </div>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Physical Description</label>
                <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={physicalDescription} onChange={(e) => setPhysicalDescription(e.target.value)} placeholder="What do they look like?" />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Backstory</label>
                <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={backstory} onChange={(e) => setBackstory(e.target.value)} placeholder="Who are they and where do they come from?" />
              </div>

              {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', margin: '0 0 1rem' }}>{error}</p>}

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.6rem 1.5rem', fontSize: '0.9rem', opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? 'Creating…' : 'Create & Enter World'}
                </button>
                {characters.length > 0 && (
                  <button type="button" onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
        </>
      )}
    </main>
  );
}

export default function CharactersPageWrapper({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<main style={{ maxWidth: '640px', margin: '0 auto', padding: '2rem' }}><p style={{ color: 'var(--text-muted)' }}>Loading…</p></main>}>
      <CharactersPage params={params} />
    </Suspense>
  );
}
