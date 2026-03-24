'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateWorldPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [laws, setLaws] = useState(['']);
  const [cultures, setCultures] = useState(['']);
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function updateList(
    list: string[],
    setList: (v: string[]) => void,
    index: number,
    value: string,
  ) {
    const next = [...list];
    next[index] = value;
    setList(next);
  }

  function addItem(list: string[], setList: (v: string[]) => void) {
    setList([...list, '']);
  }

  function removeItem(list: string[], setList: (v: string[]) => void, index: number) {
    setList(list.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const filteredLaws = laws.filter((l) => l.trim());
    const filteredCultures = cultures.filter((c) => c.trim());

    if (!name.trim() || !description.trim() || !filteredLaws.length || !filteredCultures.length) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/worlds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          visibility,
          foundationalLaws: filteredLaws,
          culturalTypologies: filteredCultures,
          anthropicApiKey: anthropicApiKey.trim() || undefined,
          // TODO: replace with authenticated user id
          creatorId: 'placeholder-creator-id',
        }),
      });

      const data = await res.json() as { world?: { slug: string }; error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Failed to create world.');
        return;
      }

      router.push(`/worlds/${data.world!.slug}`);
    } catch {
      setError('Network error. Is the server running?');
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.6rem 0.75rem',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    borderRadius: '4px',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.95rem',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.4rem',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
  };

  return (
    <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ color: 'var(--accent)', marginBottom: '0.5rem' }}>Create a World</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
        Sketch the foundations — the AI will fill in the rest as players explore.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <label style={labelStyle}>World Name</label>
          <input
            style={fieldStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. The Ember Lattice"
            required
          />
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            style={{ ...fieldStyle, minHeight: '80px', resize: 'vertical' }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief, evocative overview of this world."
            required
          />
        </div>

        <div>
          <label style={labelStyle}>Visibility</label>
          <select
            style={fieldStyle}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'PUBLIC' | 'PRIVATE')}
          >
            <option value="PUBLIC">Public — anyone can explore</option>
            <option value="PRIVATE">Private — invite only</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Foundational Laws</label>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.75rem' }}>
            The immutable rules that govern this universe (physics, magic, metaphysics…)
          </p>
          {laws.map((law, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                style={{ ...fieldStyle, flex: 1 }}
                value={law}
                onChange={(e) => updateList(laws, setLaws, i, e.target.value)}
                placeholder={`Law ${i + 1}`}
              />
              {laws.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(laws, setLaws, i)}
                  style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--error)', borderRadius: '4px', padding: '0 0.75rem' }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addItem(laws, setLaws)}
            style={{ background: 'none', border: '1px dashed var(--border)', color: 'var(--text-muted)', borderRadius: '4px', padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '100%' }}
          >
            + Add law
          </button>
        </div>

        <div>
          <label style={labelStyle}>Cultural Typologies</label>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.75rem' }}>
            The kinds of societies, belief systems, or social structures present.
          </p>
          {cultures.map((culture, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                style={{ ...fieldStyle, flex: 1 }}
                value={culture}
                onChange={(e) => updateList(cultures, setCultures, i, e.target.value)}
                placeholder={`Culture ${i + 1}`}
              />
              {cultures.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(cultures, setCultures, i)}
                  style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--error)', borderRadius: '4px', padding: '0 0.75rem' }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addItem(cultures, setCultures)}
            style={{ background: 'none', border: '1px dashed var(--border)', color: 'var(--text-muted)', borderRadius: '4px', padding: '0.4rem 0.75rem', fontSize: '0.85rem', width: '100%' }}
          >
            + Add culture
          </button>
        </div>

        <div>
          <label style={labelStyle}>Anthropic API Key <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.75rem' }}>
            Provide your own key to power this world with Claude. Without one, the world uses the server's default AI (stub mode).
          </p>
          <input
            style={fieldStyle}
            type="password"
            value={anthropicApiKey}
            onChange={(e) => setAnthropicApiKey(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
          />
        </div>

        {error && (
          <p style={{ color: 'var(--error)', margin: 0, fontSize: '0.9rem' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.75rem',
            background: loading ? 'var(--accent-dim)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Weaving world…' : 'Create World'}
        </button>
      </form>
    </main>
  );
}
