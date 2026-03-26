'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getStoredUserId } from '@/lib/auth';

interface VedaZone {
  id: string;
  slug: string;
  name: string;
  description: string;
  rawContent: string;
  atmosphereTags?: string[];
  discoveredAt: string;
}

interface VedaEntity {
  id: string;
  name: string;
  entityType: string;
  description: string;
  attributes: Record<string, unknown>;
  discoveredAt: string;
}

interface VedaEvent {
  id: string;
  description: string;
  occurredAt: string;
}

interface VedaLore {
  id: string;
  category: string;
  title: string;
  content: string;
  createdAt: string;
}

interface NPC {
  id: string;
  worldId: string;
  name: string;
  species: string | null;
  race: string | null;
  gender: string | null;
  age: number | null;
  physicalDescription: string | null;
  traits: string[];
  skills: Record<string, number>;
  abilities: string[];
  backstory: string | null;
  disposition: string;
  memories: string[];
  knownNpcIds: string[];
  knownCharacterIds: string[];
  currentZone: { name: string; slug: string } | null;
  updatedAt: string;
}

interface WorldFeature {
  id: string;
  name: string;
  featureType: string;
  description: string;
  builtByPlayerId: string | null;
  builtByCharacterId: string | null;
  attributes: Record<string, unknown>;
  createdAt: string;
  zone?: { name: string; slug: string } | null;
  interactions?: Array<{ id: string; playerId: string; action: string; timestamp: string }>;
}

interface VedaData {
  zones: VedaZone[];
  entities: VedaEntity[];
  lore: VedaLore[];
  recentEvents: VedaEvent[];
}

interface Character {
  id: string;
  name: string;
}

function dispositionColor(d: string): string {
  switch (d) {
    case 'friendly': return 'var(--success)';
    case 'hostile': return 'var(--error)';
    case 'wary': return 'var(--warning)';
    default: return 'var(--text-muted)';
  }
}

const sectionLabel: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  margin: '0 0 0.75rem',
};

const card: React.CSSProperties = {
  borderLeft: '2px solid var(--border)',
  paddingLeft: '1rem',
  marginBottom: '1.25rem',
};

const tag: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '0.7rem',
  padding: '0.15rem 0.5rem',
  border: '1px solid var(--border)',
  borderRadius: '3px',
  color: 'var(--text-muted)',
  marginBottom: '0.4rem',
};

export default function VedaPage() {
  const params = useParams();
  const slug = params['slug'] as string;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  const [authState, setAuthState] = useState<'loading' | 'denied' | 'ok'>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [veda, setVeda] = useState<VedaData | null>(null);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [features, setFeatures] = useState<WorldFeature[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const uid = getStoredUserId();
      if (!uid) { setAuthState('denied'); return; }

      try {
        const res = await fetch(`${apiUrl}/api/auth/me?userId=${uid}`);
        if (!res.ok) { setAuthState('denied'); return; }
        const data = await res.json() as { user?: { role: string } };
        if (data?.user?.role !== 'ADMIN') { setAuthState('denied'); return; }
        setUserId(uid);
        setAuthState('ok');
      } catch {
        setAuthState('denied');
      }
    }
    checkAuth();
  }, [apiUrl]);

  useEffect(() => {
    if (authState !== 'ok' || !userId) return;

    async function loadData() {
      setDataLoading(true);
      const headers = { 'x-rishi-id': userId! };
      try {
        const [vedaRes, npcsRes, featuresRes] = await Promise.all([
          fetch(`${apiUrl}/api/worlds/${slug}/veda`, { headers, cache: 'no-store' }),
          fetch(`${apiUrl}/api/worlds/${slug}/npcs`, { headers, cache: 'no-store' }),
          fetch(`${apiUrl}/api/worlds/${slug}/features`, { headers, cache: 'no-store' }),
        ]);

        if (vedaRes.ok) setVeda(await vedaRes.json() as VedaData);
        if (npcsRes.ok) {
          const npcData = await npcsRes.json() as { npcs: NPC[] };
          setNpcs(npcData.npcs ?? []);

          // Fetch characters for the world to resolve knownCharacterIds
          const worldId = npcData.npcs[0]?.worldId;
          if (worldId) {
            const charRes = await fetch(`${apiUrl}/api/characters?worldId=${worldId}`);
            if (charRes.ok) {
              const charData = await charRes.json() as { characters: Character[] };
              setCharacters(charData.characters ?? []);
            }
          }
        }
        if (featuresRes.ok) {
          const fData = await featuresRes.json() as { features: WorldFeature[] };
          setFeatures(fData.features ?? []);
        }
      } catch {
        // Silently fail — partial data shown
      }
      setDataLoading(false);
    }
    loadData();
  }, [authState, userId, slug, apiUrl]);

  if (authState === 'loading') {
    return (
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Checking access…</p>
      </main>
    );
  }

  if (authState === 'denied') {
    return (
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--error)', marginBottom: '0.5rem' }}>Access Restricted</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          The Veda is available to Rishis only.
        </p>
        <Link href={`/worlds/${slug}`} style={{ color: 'var(--accent)' }}>← Back to world</Link>
      </main>
    );
  }

  if (dataLoading) {
    return (
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading Veda…</p>
      </main>
    );
  }

  if (!veda) {
    return (
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Veda not found.</p>
        <Link href={`/worlds/${slug}`} style={{ color: 'var(--accent)' }}>Back to world</Link>
      </main>
    );
  }

  const { zones, entities, lore, recentEvents } = veda;

  // Lookup maps for resolving known IDs to names
  const npcById: Record<string, string> = Object.fromEntries(npcs.map(n => [n.id, n.name]));
  const charById: Record<string, string> = Object.fromEntries(characters.map(c => [c.id, c.name]));

  const counts = [
    `${zones.length} zone${zones.length !== 1 ? 's' : ''}`,
    `${npcs.length} npc${npcs.length !== 1 ? 's' : ''}`,
    `${features.length} feature${features.length !== 1 ? 's' : ''}`,
    `${entities.length} entit${entities.length !== 1 ? 'ies' : 'y'}`,
    `${lore.length} lore`,
    `${recentEvents.length} event${recentEvents.length !== 1 ? 's' : ''}`,
  ].join(' · ');

  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
        <Link href={`/worlds/${slug}`} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          ← {slug}
        </Link>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'baseline' }}>
          <Link href={`/worlds/${slug}/veda/edit`} style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
            Edit Veda ↗
          </Link>
          <Link href={`/worlds/${slug}/play`} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Enter World →
          </Link>
        </div>
      </div>

      <h1 style={{ color: 'var(--accent)', margin: '1rem 0 0.25rem' }}>Veda</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2.5rem' }}>{counts}</p>

      {/* Zones */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={sectionLabel}>Zones ({zones.length})</h3>
        {zones.length === 0 && <p style={{ color: 'var(--text-muted)' }}>None recorded.</p>}
        {zones.map((z) => (
          <div key={z.id} style={card}>
            <div style={{ color: 'var(--accent)', fontWeight: 'bold', marginBottom: '0.2rem' }}>{z.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>{z.slug}</div>
            <div style={{ color: 'var(--text)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{z.description}</div>
            {z.atmosphereTags && z.atmosphereTags.length > 0 && (
              <div style={{ marginBottom: '0.4rem' }}>
                {z.atmosphereTags.map((t, i) => <span key={i} style={{ ...tag, marginRight: '0.3rem' }}>{t}</span>)}
              </div>
            )}
            <details>
              <summary style={{ color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}>Raw content</summary>
              <div style={{ color: 'var(--text)', fontSize: '0.85rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {z.rawContent}
              </div>
            </details>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              Discovered {new Date(z.discoveredAt).toLocaleString()}
            </div>
          </div>
        ))}
      </section>

      {/* NPCs */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={sectionLabel}>NPCs ({npcs.length})</h3>
        {npcs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>None encountered yet.</p>}
        {npcs.map((n) => (
          <div key={n.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{n.name}</span>
              {n.species && <span style={tag}>{n.species}</span>}
              {n.race && n.race !== n.species && <span style={tag}>{n.race}</span>}
              {n.gender && <span style={tag}>{n.gender}</span>}
              <span style={{ ...tag, borderColor: dispositionColor(n.disposition), color: dispositionColor(n.disposition) }}>
                {n.disposition}
              </span>
            </div>
            {n.currentZone && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                Last seen: {n.currentZone.name}
              </div>
            )}
            {n.physicalDescription && (
              <div style={{ color: 'var(--text)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>{n.physicalDescription}</div>
            )}
            {n.traits.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                {n.traits.map((t, i) => <span key={i} style={tag}>{t}</span>)}
              </div>
            )}
            {n.backstory && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: '0.4rem' }}>
                {n.backstory}
              </div>
            )}
            {(n.abilities.length > 0 || Object.keys(n.skills).length > 0) && (
              <details>
                <summary style={{ color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}>Skills & Abilities</summary>
                <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: 'var(--text)' }}>
                  {Object.keys(n.skills).length > 0 && (
                    <div style={{ marginBottom: '0.3rem' }}>
                      {Object.entries(n.skills).map(([skill, level]) => (
                        <span key={skill} style={{ ...tag, marginRight: '0.3rem' }}>{skill} {level}</span>
                      ))}
                    </div>
                  )}
                  {n.abilities.map((a, i) => <span key={i} style={{ ...tag, marginRight: '0.3rem' }}>{a}</span>)}
                </div>
              </details>
            )}

            {/* Memory & Social Knowledge */}
            {n.memories.length > 0 && (
              <details style={{ marginTop: '0.4rem' }}>
                <summary style={{ color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}>
                  Memories ({n.memories.length})
                </summary>
                <div style={{ marginTop: '0.4rem', fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5 }}>
                  {n.memories.map((m, i) => (
                    <div key={i} style={{ marginBottom: '0.2rem', paddingLeft: '0.5rem', borderLeft: '1px solid var(--border)' }}>
                      {m}
                    </div>
                  ))}
                </div>
              </details>
            )}
            {n.knownNpcIds.length > 0 && (
              <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span style={{ opacity: 0.7 }}>Knows NPCs: </span>
                {n.knownNpcIds.map(id => npcById[id] ?? id).filter(Boolean).join(', ')}
              </div>
            )}
            {n.knownCharacterIds.length > 0 && (
              <div style={{ marginTop: '0.2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span style={{ opacity: 0.7 }}>Knows Characters: </span>
                {n.knownCharacterIds.map(id => charById[id] ?? id).filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Player-Built Features */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={sectionLabel}>Features ({features.length})</h3>
        {features.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No features built yet.</p>}
        {features.map((f) => (
          <div key={f.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{f.name}</span>
              <span style={tag}>{f.featureType}</span>
              {f.zone && <span style={{ ...tag, color: 'var(--text-muted)' }}>{f.zone.name}</span>}
            </div>
            <div style={{ color: 'var(--text)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>{f.description}</div>
            {f.interactions && f.interactions.length > 0 && (
              <details>
                <summary style={{ color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}>
                  {f.interactions.length} interaction{f.interactions.length !== 1 ? 's' : ''}
                </summary>
                <div style={{ marginTop: '0.4rem' }}>
                  {f.interactions.map((i) => (
                    <div key={i.id} style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                      {i.action} — {new Date(i.timestamp).toLocaleString()}
                    </div>
                  ))}
                </div>
              </details>
            )}
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.4rem' }}>
              Built {new Date(f.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </section>

      {/* Entities (Veda knowledge records) */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={sectionLabel}>Entities ({entities.length})</h3>
        {entities.length === 0 && <p style={{ color: 'var(--text-muted)' }}>None recorded.</p>}
        {entities.map((e) => (
          <div key={e.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{e.name}</span>
              <span style={tag}>{e.entityType}</span>
            </div>
            <div style={{ color: 'var(--text)', fontSize: '0.9rem', marginBottom: '0.4rem' }}>{e.description}</div>
            {Object.keys(e.attributes).length > 0 && (
              <details>
                <summary style={{ color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}>Attributes</summary>
                <pre style={{ color: 'var(--text)', fontSize: '0.8rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(e.attributes, null, 2)}
                </pre>
              </details>
            )}
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.4rem' }}>
              Discovered {new Date(e.discoveredAt).toLocaleString()}
            </div>
          </div>
        ))}
      </section>

      {/* Lore */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={sectionLabel}>Lore ({lore.length})</h3>
        {lore.length === 0 && <p style={{ color: 'var(--text-muted)' }}>None recorded.</p>}
        {lore.map((l) => (
          <div key={l.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{l.title}</span>
              <span style={tag}>{l.category}</span>
            </div>
            <div style={{ color: 'var(--text)', fontSize: '0.9rem', lineHeight: 1.6 }}>{l.content}</div>
          </div>
        ))}
      </section>

      {/* Events */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={sectionLabel}>Recent Events ({recentEvents.length})</h3>
        {recentEvents.length === 0 && <p style={{ color: 'var(--text-muted)' }}>None recorded.</p>}
        {recentEvents.map((ev) => (
          <div key={ev.id} style={card}>
            <div style={{ color: 'var(--text)', fontSize: '0.9rem', marginBottom: '0.3rem' }}>{ev.description}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
              {new Date(ev.occurredAt).toLocaleString()}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
