'use client';

import { useState, useEffect, useCallback } from 'react';
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
  physicalDescription: string | null;
  traits: string[];
  disposition: string;
  backstory: string | null;
  skills: Record<string, number>;
  abilities: string[];
  memories: string[];
  currentZone: { name: string; slug: string } | null;
}

interface VedaData {
  zones: VedaZone[];
  entities: VedaEntity[];
  lore: VedaLore[];
  recentEvents: VedaEvent[];
}

// ── Editable field component ───────────────────────────────────────────────────

function EditableText({
  value,
  onSave,
  multiline = false,
  placeholder = '—',
}: {
  value: string | null | undefined;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {multiline ? (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            style={{
              flex: 1, minWidth: '200px', background: 'var(--bg)', color: 'var(--text)',
              border: '1px solid var(--accent)', borderRadius: '3px', padding: '0.3rem', fontSize: '0.85rem',
            }}
          />
        ) : (
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            style={{
              flex: 1, minWidth: '200px', background: 'var(--bg)', color: 'var(--text)',
              border: '1px solid var(--accent)', borderRadius: '3px', padding: '0.3rem', fontSize: '0.85rem',
            }}
          />
        )}
        <button
          onClick={save}
          disabled={saving}
          style={{
            background: 'none', border: '1px solid var(--success)', color: 'var(--success)',
            borderRadius: '3px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer',
          }}
        >
          {saving ? '…' : 'Save'}
        </button>
        <button
          onClick={() => { setDraft(value ?? ''); setEditing(false); }}
          style={{
            background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
            borderRadius: '3px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span
      onClick={() => { setDraft(value ?? ''); setEditing(true); }}
      title="Click to edit"
      style={{ cursor: 'text', borderBottom: '1px dashed var(--border)', color: value ? 'var(--text)' : 'var(--text-muted)' }}
    >
      {value || placeholder}
    </span>
  );
}

function EditableArray({
  value,
  onSave,
  label,
}: {
  value: string[];
  onSave: (v: string[]) => Promise<void>;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.join('\n'));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const arr = draft.split('\n').map(s => s.trim()).filter(Boolean);
    await onSave(arr);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ marginTop: '0.3rem' }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={4}
          style={{
            width: '100%', background: 'var(--bg)', color: 'var(--text)',
            border: '1px solid var(--accent)', borderRadius: '3px', padding: '0.3rem',
            fontSize: '0.82rem', marginBottom: '0.3rem',
          }}
          placeholder="One per line"
        />
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              background: 'none', border: '1px solid var(--success)', color: 'var(--success)',
              borderRadius: '3px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            onClick={() => { setDraft(value.join('\n')); setEditing(false); }}
            style={{
              background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
              borderRadius: '3px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => { setDraft(value.join('\n')); setEditing(true); }}
      title="Click to edit"
      style={{ cursor: 'text', borderBottom: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '0.82rem' }}
    >
      {label}: {value.length > 0 ? value.join(', ') : '—'}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function VedaEditPage() {
  const params = useParams();
  const slug = params['slug'] as string;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

  const [authState, setAuthState] = useState<'loading' | 'denied' | 'ok'>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [veda, setVeda] = useState<VedaData | null>(null);
  const [npcs, setNpcs] = useState<NPC[]>([]);
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
        const [vedaRes, npcsRes] = await Promise.all([
          fetch(`${apiUrl}/api/worlds/${slug}/veda`, { headers, cache: 'no-store' }),
          fetch(`${apiUrl}/api/worlds/${slug}/npcs`, { headers, cache: 'no-store' }),
        ]);
        if (vedaRes.ok) setVeda(await vedaRes.json() as VedaData);
        if (npcsRes.ok) {
          const d = await npcsRes.json() as { npcs: NPC[] };
          setNpcs(d.npcs ?? []);
        }
      } catch { /* partial data */ }
      setDataLoading(false);
    }
    loadData();
  }, [authState, userId, slug, apiUrl]);

  const patchZone = useCallback(async (zoneSlug: string, field: string, value: unknown) => {
    await fetch(`${apiUrl}/api/worlds/${slug}/veda/zones/${zoneSlug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-rishi-id': userId! },
      body: JSON.stringify({ [field]: value }),
    });
    // Refresh veda data
    const res = await fetch(`${apiUrl}/api/worlds/${slug}/veda`, { headers: { 'x-rishi-id': userId! }, cache: 'no-store' });
    if (res.ok) setVeda(await res.json() as VedaData);
  }, [apiUrl, slug, userId]);

  const patchEntity = useCallback(async (entityId: string, field: string, value: unknown) => {
    await fetch(`${apiUrl}/api/worlds/${slug}/veda/entities/${entityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-rishi-id': userId! },
      body: JSON.stringify({ [field]: value }),
    });
    const res = await fetch(`${apiUrl}/api/worlds/${slug}/veda`, { headers: { 'x-rishi-id': userId! }, cache: 'no-store' });
    if (res.ok) setVeda(await res.json() as VedaData);
  }, [apiUrl, slug, userId]);

  const patchLore = useCallback(async (loreId: string, field: string, value: unknown) => {
    await fetch(`${apiUrl}/api/worlds/${slug}/veda/lore/${loreId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-rishi-id': userId! },
      body: JSON.stringify({ [field]: value }),
    });
    const res = await fetch(`${apiUrl}/api/worlds/${slug}/veda`, { headers: { 'x-rishi-id': userId! }, cache: 'no-store' });
    if (res.ok) setVeda(await res.json() as VedaData);
  }, [apiUrl, slug, userId]);

  const patchEvent = useCallback(async (eventId: string, field: string, value: unknown) => {
    await fetch(`${apiUrl}/api/worlds/${slug}/veda/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-rishi-id': userId! },
      body: JSON.stringify({ [field]: value }),
    });
    const res = await fetch(`${apiUrl}/api/worlds/${slug}/veda`, { headers: { 'x-rishi-id': userId! }, cache: 'no-store' });
    if (res.ok) setVeda(await res.json() as VedaData);
  }, [apiUrl, slug, userId]);

  const patchNPC = useCallback(async (npcId: string, field: string, value: unknown) => {
    await fetch(`${apiUrl}/api/worlds/${slug}/npcs/${npcId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-rishi-id': userId! },
      body: JSON.stringify({ [field]: value }),
    });
    const res = await fetch(`${apiUrl}/api/worlds/${slug}/npcs`, { headers: { 'x-rishi-id': userId! }, cache: 'no-store' });
    if (res.ok) {
      const d = await res.json() as { npcs: NPC[] };
      setNpcs(d.npcs ?? []);
    }
  }, [apiUrl, slug, userId]);

  const deleteZone = useCallback(async (zoneSlug: string) => {
    if (!confirm('Delete this zone? This cannot be undone.')) return;
    await fetch(`${apiUrl}/api/worlds/${slug}/veda/zones/${zoneSlug}`, {
      method: 'DELETE',
      headers: { 'x-rishi-id': userId! },
    });
    setVeda(prev => prev ? { ...prev, zones: prev.zones.filter(z => z.slug !== zoneSlug) } : prev);
  }, [apiUrl, slug, userId]);

  const deleteEntity = useCallback(async (entityId: string) => {
    if (!confirm('Delete this entity? This cannot be undone.')) return;
    await fetch(`${apiUrl}/api/worlds/${slug}/veda/entities/${entityId}`, {
      method: 'DELETE',
      headers: { 'x-rishi-id': userId! },
    });
    setVeda(prev => prev ? { ...prev, entities: prev.entities.filter(e => e.id !== entityId) } : prev);
  }, [apiUrl, slug, userId]);

  const deleteLore = useCallback(async (loreId: string) => {
    if (!confirm('Delete this lore entry? This cannot be undone.')) return;
    await fetch(`${apiUrl}/api/worlds/${slug}/veda/lore/${loreId}`, {
      method: 'DELETE',
      headers: { 'x-rishi-id': userId! },
    });
    setVeda(prev => prev ? { ...prev, lore: prev.lore.filter(l => l.id !== loreId) } : prev);
  }, [apiUrl, slug, userId]);

  const deleteEvent = useCallback(async (eventId: string) => {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    await fetch(`${apiUrl}/api/worlds/${slug}/veda/events/${eventId}`, {
      method: 'DELETE',
      headers: { 'x-rishi-id': userId! },
    });
    setVeda(prev => prev ? { ...prev, recentEvents: prev.recentEvents.filter(e => e.id !== eventId) } : prev);
  }, [apiUrl, slug, userId]);

  const deleteNPC = useCallback(async (npcId: string) => {
    if (!confirm('Delete this NPC? This cannot be undone.')) return;
    await fetch(`${apiUrl}/api/worlds/${slug}/npcs/${npcId}`, {
      method: 'DELETE',
      headers: { 'x-rishi-id': userId! },
    });
    setNpcs(prev => prev.filter(n => n.id !== npcId));
  }, [apiUrl, slug, userId]);

  const sectionLabel: React.CSSProperties = {
    color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase',
    letterSpacing: '0.12em', margin: '0 0 0.75rem',
  };
  const card: React.CSSProperties = {
    borderLeft: '2px solid var(--border)', paddingLeft: '1rem', marginBottom: '1.25rem',
  };
  const fieldRow: React.CSSProperties = {
    marginBottom: '0.4rem', fontSize: '0.88rem',
  };
  const fieldLabel: React.CSSProperties = {
    color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.1rem',
  };

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
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Veda editing is available to Rishis only.</p>
        <Link href={`/worlds/${slug}`} style={{ color: 'var(--accent)' }}>← Back to world</Link>
      </main>
    );
  }

  if (dataLoading) {
    return (
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </main>
    );
  }

  if (!veda) {
    return (
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Veda not found.</p>
      </main>
    );
  }

  const { zones, entities, lore, recentEvents } = veda;

  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
        <Link href={`/worlds/${slug}/veda`} style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          ← Veda
        </Link>
        <Link href={`/worlds/${slug}/play`} style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
          Enter World →
        </Link>
      </div>

      <h1 style={{ color: 'var(--accent)', margin: '1rem 0 0.25rem' }}>Veda Editor</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2.5rem' }}>
        Click any field value to edit it inline.
      </p>

      {/* Zones */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={sectionLabel}>Zones ({zones.length})</h3>
        {zones.map((z) => (
          <div key={z.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{z.name} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.8rem' }}>({z.slug})</span></span>
              <button onClick={() => deleteZone(z.slug)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.75rem', padding: '0 4px' }}>Delete</button>
            </div>
            <div style={fieldLabel}>Name</div>
            <div style={fieldRow}>
              <EditableText value={z.name} onSave={v => patchZone(z.slug, 'name', v)} />
            </div>
            <div style={fieldLabel}>Description (short)</div>
            <div style={fieldRow}>
              <EditableText value={z.description} onSave={v => patchZone(z.slug, 'description', v)} multiline />
            </div>
            <div style={fieldLabel}>Raw Content (full description)</div>
            <div style={fieldRow}>
              <EditableText value={z.rawContent} onSave={v => patchZone(z.slug, 'rawContent', v)} multiline />
            </div>
            <EditableArray
              value={z.atmosphereTags ?? []}
              onSave={v => patchZone(z.slug, 'atmosphereTags', v)}
              label="Atmosphere Tags"
            />
          </div>
        ))}
        {zones.length === 0 && <p style={{ color: 'var(--text-muted)' }}>None recorded.</p>}
      </section>

      {/* NPCs */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={sectionLabel}>NPCs ({npcs.length})</h3>
        {npcs.map((n) => (
          <div key={n.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>
                {n.name}
                {n.currentZone && <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.8rem' }}> · {n.currentZone.name}</span>}
              </span>
              <button onClick={() => deleteNPC(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.75rem', padding: '0 4px' }}>Delete</button>
            </div>
            <div style={fieldLabel}>Name</div>
            <div style={fieldRow}>
              <EditableText value={n.name} onSave={v => patchNPC(n.id, 'name', v)} />
            </div>
            <div style={fieldLabel}>Physical Description</div>
            <div style={fieldRow}>
              <EditableText value={n.physicalDescription} onSave={v => patchNPC(n.id, 'physicalDescription', v)} multiline />
            </div>
            <div style={fieldLabel}>Disposition</div>
            <div style={fieldRow}>
              <EditableText value={n.disposition} onSave={v => patchNPC(n.id, 'disposition', v)} placeholder="neutral" />
            </div>
            <div style={fieldLabel}>Backstory</div>
            <div style={fieldRow}>
              <EditableText value={n.backstory} onSave={v => patchNPC(n.id, 'backstory', v)} multiline />
            </div>
            <EditableArray value={n.traits} onSave={v => patchNPC(n.id, 'traits', v)} label="Traits" />
            <EditableArray value={n.abilities} onSave={v => patchNPC(n.id, 'abilities', v)} label="Abilities" />
            <EditableArray value={n.memories} onSave={v => patchNPC(n.id, 'memories', v)} label="Memories" />
          </div>
        ))}
        {npcs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>None encountered yet.</p>}
      </section>

      {/* Entities */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={sectionLabel}>Entities ({entities.length})</h3>
        {entities.map((e) => (
          <div key={e.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{e.name}</span>
              <button onClick={() => deleteEntity(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.75rem', padding: '0 4px' }}>Delete</button>
            </div>
            <div style={fieldLabel}>Name</div>
            <div style={fieldRow}>
              <EditableText value={e.name} onSave={v => patchEntity(e.id, 'name', v)} />
            </div>
            <div style={fieldLabel}>Description</div>
            <div style={fieldRow}>
              <EditableText value={e.description} onSave={v => patchEntity(e.id, 'description', v)} multiline />
            </div>
            <div style={fieldLabel}>Entity Type</div>
            <div style={fieldRow}>
              <EditableText value={e.entityType} onSave={v => patchEntity(e.id, 'entityType', v)} />
            </div>
          </div>
        ))}
        {entities.length === 0 && <p style={{ color: 'var(--text-muted)' }}>None recorded.</p>}
      </section>

      {/* Lore */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={sectionLabel}>Lore ({lore.length})</h3>
        {lore.map((l) => (
          <div key={l.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{l.title}</span>
              <button onClick={() => deleteLore(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.75rem', padding: '0 4px' }}>Delete</button>
            </div>
            <div style={fieldLabel}>Title</div>
            <div style={fieldRow}>
              <EditableText value={l.title} onSave={v => patchLore(l.id, 'title', v)} />
            </div>
            <div style={fieldLabel}>Category</div>
            <div style={fieldRow}>
              <EditableText value={l.category} onSave={v => patchLore(l.id, 'category', v)} />
            </div>
            <div style={fieldLabel}>Content</div>
            <div style={fieldRow}>
              <EditableText value={l.content} onSave={v => patchLore(l.id, 'content', v)} multiline />
            </div>
          </div>
        ))}
        {lore.length === 0 && <p style={{ color: 'var(--text-muted)' }}>None recorded.</p>}
      </section>

      {/* Events */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h3 style={sectionLabel}>Recent Events ({recentEvents.length})</h3>
        {recentEvents.map((ev) => (
          <div key={ev.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.3rem' }}>
              <button onClick={() => deleteEvent(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.75rem', padding: '0 4px' }}>Delete</button>
            </div>
            <div style={fieldLabel}>Description</div>
            <div style={fieldRow}>
              <EditableText value={ev.description} onSave={v => patchEvent(ev.id, 'description', v)} multiline />
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.3rem' }}>
              {new Date(ev.occurredAt).toLocaleString()}
            </div>
          </div>
        ))}
        {recentEvents.length === 0 && <p style={{ color: 'var(--text-muted)' }}>None recorded.</p>}
      </section>
    </main>
  );
}
