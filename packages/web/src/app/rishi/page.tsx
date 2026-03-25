'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchCurrentUser, type CurrentUser } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
  displayRole: string;
  createdAt: string;
}

interface AdminWorld {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: string;
  foundationalLaws: string[];
  culturalTypologies: string[];
  creatorId: string;
  createdAt: string;
  creator: { username: string };
}

interface AdminCharacter {
  id: string;
  name: string;
  species: string | null;
  race: string | null;
  gender: string | null;
  traits: string[];
  userId: string;
  worldId: string;
  user: { username: string };
  world: { name: string; slug: string };
}

interface VedaZone {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  rawContent: string;
  worldId: string;
}

interface VedaEntity {
  id: string;
  name: string;
  entityType: string;
  description: string | null;
  worldId: string;
}

interface VedaLore {
  id: string;
  title: string;
  category: string;
  content: string;
  worldId: string;
}

interface VedaData {
  zones: VedaZone[];
  entities: VedaEntity[];
  lore: VedaLore[];
}

// ── Styles ────────────────────────────────────────────────────────────────────

const tabBtn = (active: boolean): React.CSSProperties => ({
  background: active ? 'var(--accent)' : 'none',
  color: active ? '#fff' : 'var(--text-muted)',
  border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
  borderRadius: '4px',
  padding: '0.35rem 1rem',
  fontSize: '0.82rem',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)',
});

const sectionHead: React.CSSProperties = {
  color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase',
  letterSpacing: '0.12em', marginBottom: '0.5rem',
};

const inputSm: React.CSSProperties = { fontSize: '0.85rem', padding: '0.3rem 0.5rem', width: '100%' };

const dangerBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--error, #c0392b)',
  color: 'var(--error, #c0392b)', borderRadius: '4px',
  padding: '0.2rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer',
};

const accentBtn: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff', border: 'none',
  borderRadius: '4px', padding: '0.3rem 0.9rem', fontSize: '0.82rem', cursor: 'pointer',
};

const mutedBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
  borderRadius: '4px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', cursor: 'pointer',
};

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab({ rishiId }: { rishiId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add user form
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState('PLAYER');
  const [adding, setAdding] = useState(false);

  // Inline actions
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editRole, setEditRole] = useState('');

  const headers = { 'Content-Type': 'application/json', 'X-Rishi-Id': rishiId };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { users: u } = await fetch(`${API}/api/admin/users`, { headers: { 'X-Rishi-Id': rishiId } }).then(r => r.json());
      setUsers(u ?? []);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [rishiId]);

  useEffect(() => { load(); }, [load]);

  async function addUser() {
    if (!addUsername || !addPassword) return;
    setAdding(true);
    try {
      const res = await fetch(`${API}/api/admin/users`, {
        method: 'POST', headers,
        body: JSON.stringify({ username: addUsername, password: addPassword, role: addRole }),
      });
      if (!res.ok) { const e = await res.json(); setError(e.error); return; }
      setAddUsername(''); setAddPassword(''); setAddRole('PLAYER');
      await load();
    } finally { setAdding(false); }
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user?')) return;
    const res = await fetch(`${API}/api/admin/users/${id}`, { method: 'DELETE', headers: { 'X-Rishi-Id': rishiId } });
    if (!res.ok) { const e = await res.json(); setError(e.error); return; }
    await load();
  }

  async function resetPassword(id: string) {
    if (!resetPw || resetPw.length < 6) { setError('Password must be at least 6 chars.'); return; }
    const res = await fetch(`${API}/api/admin/users/${id}/reset-password`, {
      method: 'POST', headers,
      body: JSON.stringify({ password: resetPw }),
    });
    if (!res.ok) { const e = await res.json(); setError(e.error); return; }
    setResetId(null); setResetPw('');
  }

  async function saveEdit(id: string) {
    const body: Record<string, string> = {};
    if (editUsername) body.username = editUsername;
    if (editRole) body.role = editRole;
    const res = await fetch(`${API}/api/admin/users/${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) { const e = await res.json(); setError(e.error); return; }
    setEditId(null); setEditUsername(''); setEditRole('');
    await load();
  }

  const rolePill = (displayRole: string) => {
    const color = displayRole === 'Rishi' ? 'var(--warning, #e8a838)' : displayRole === 'Creator' ? 'var(--accent)' : 'var(--text-muted)';
    return <span style={{ color, fontSize: '0.75rem', border: `1px solid ${color}`, borderRadius: '4px', padding: '0 0.4rem' }}>{displayRole}</span>;
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading users…</p>;

  return (
    <div>
      {error && <p style={{ color: 'var(--error, #c0392b)', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</p>}

      {/* Add user */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '1rem', marginBottom: '1.5rem' }}>
        <p style={sectionHead}>Add User</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input style={{ ...inputSm, width: '160px' }} placeholder="Username" value={addUsername} onChange={e => setAddUsername(e.target.value)} />
          <input style={{ ...inputSm, width: '160px' }} type="password" placeholder="Password" value={addPassword} onChange={e => setAddPassword(e.target.value)} />
          <select style={{ ...inputSm, width: '120px' }} value={addRole} onChange={e => setAddRole(e.target.value)}>
            <option value="PLAYER">Player</option>
            <option value="CREATOR">Creator</option>
            <option value="ADMIN">Rishi</option>
          </select>
          <button style={accentBtn} onClick={addUser} disabled={adding}>{adding ? 'Adding…' : 'Add User'}</button>
        </div>
      </div>

      {/* User list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {users.map(u => (
          <div key={u.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: 'var(--text)', fontWeight: 'bold' }}>{u.username}</span>
                {rolePill(u.displayRole)}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{new Date(u.createdAt).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={mutedBtn} onClick={() => { setEditId(u.id); setEditUsername(u.username); setEditRole(u.role); }}>Edit</button>
                <button style={mutedBtn} onClick={() => { setResetId(u.id); setResetPw(''); }}>Reset PW</button>
                <button style={dangerBtn} onClick={() => deleteUser(u.id)}>Delete</button>
              </div>
            </div>

            {editId === u.id && (
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input style={{ ...inputSm, width: '160px' }} placeholder="New username" value={editUsername} onChange={e => setEditUsername(e.target.value)} />
                <select style={{ ...inputSm, width: '120px' }} value={editRole} onChange={e => setEditRole(e.target.value)}>
                  <option value="PLAYER">Player</option>
                  <option value="CREATOR">Creator</option>
                  <option value="ADMIN">Rishi</option>
                </select>
                <button style={accentBtn} onClick={() => saveEdit(u.id)}>Save</button>
                <button style={mutedBtn} onClick={() => setEditId(null)}>Cancel</button>
              </div>
            )}

            {resetId === u.id && (
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input style={{ ...inputSm, width: '200px' }} type="password" placeholder="New password (min 6)" value={resetPw} onChange={e => setResetPw(e.target.value)} />
                <button style={accentBtn} onClick={() => resetPassword(u.id)}>Set Password</button>
                <button style={mutedBtn} onClick={() => setResetId(null)}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Worlds Tab ────────────────────────────────────────────────────────────────

function WorldsTab({ rishiId }: { rishiId: string }) {
  const [worlds, setWorlds] = useState<AdminWorld[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editVis, setEditVis] = useState('PUBLIC');
  const [editLaws, setEditLaws] = useState('');
  const [editCultures, setEditCultures] = useState('');

  const headers = { 'Content-Type': 'application/json', 'X-Rishi-Id': rishiId };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { worlds: w } = await fetch(`${API}/api/admin/worlds`, { headers: { 'X-Rishi-Id': rishiId } }).then(r => r.json());
      setWorlds(w ?? []);
    } catch {
      setError('Failed to load worlds.');
    } finally { setLoading(false); }
  }, [rishiId]);

  useEffect(() => { load(); }, [load]);

  function startEdit(w: AdminWorld) {
    setEditId(w.id);
    setEditName(w.name);
    setEditDesc(w.description ?? '');
    setEditVis(w.visibility);
    setEditLaws(w.foundationalLaws.join('\n'));
    setEditCultures(w.culturalTypologies.join('\n'));
  }

  async function saveWorld(id: string) {
    const res = await fetch(`${API}/api/admin/worlds/${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({
        name: editName,
        description: editDesc || null,
        visibility: editVis,
        foundationalLaws: editLaws.split('\n').map(s => s.trim()).filter(Boolean),
        culturalTypologies: editCultures.split('\n').map(s => s.trim()).filter(Boolean),
      }),
    });
    if (!res.ok) { const e = await res.json(); setError(e.error); return; }
    setEditId(null);
    await load();
  }

  async function deleteWorld(id: string, name: string) {
    if (!confirm(`Delete world "${name}"? This cannot be undone.`)) return;
    const res = await fetch(`${API}/api/admin/worlds/${id}`, { method: 'DELETE', headers: { 'X-Rishi-Id': rishiId } });
    if (!res.ok) { const e = await res.json(); setError(e.error); return; }
    await load();
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading worlds…</p>;

  return (
    <div>
      {error && <p style={{ color: 'var(--error, #c0392b)', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {worlds.map(w => (
          <div key={w.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <Link href={`/worlds/${w.slug}`} style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{w.name}</Link>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.75rem' }}>
                  {w.visibility === 'PRIVATE' ? '🔒 ' : ''}{w.creator.username} · {new Date(w.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={mutedBtn} onClick={() => startEdit(w)}>Edit</button>
                <button style={dangerBtn} onClick={() => deleteWorld(w.id, w.name)}>Delete</button>
              </div>
            </div>

            {editId === w.id && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input style={inputSm} placeholder="Name" value={editName} onChange={e => setEditName(e.target.value)} />
                <textarea style={{ ...inputSm, resize: 'vertical' }} rows={2} placeholder="Description" value={editDesc} onChange={e => setEditDesc(e.target.value)} />
                <select style={{ ...inputSm, width: '160px' }} value={editVis} onChange={e => setEditVis(e.target.value)}>
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private</option>
                </select>
                <label style={sectionHead}>Foundational Laws (one per line)</label>
                <textarea style={{ ...inputSm, resize: 'vertical' }} rows={3} value={editLaws} onChange={e => setEditLaws(e.target.value)} />
                <label style={sectionHead}>Cultural Typologies (one per line)</label>
                <textarea style={{ ...inputSm, resize: 'vertical' }} rows={3} value={editCultures} onChange={e => setEditCultures(e.target.value)} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button style={accentBtn} onClick={() => saveWorld(w.id)}>Save</button>
                  <button style={mutedBtn} onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Veda Tab ──────────────────────────────────────────────────────────────────

function VedaTab({ rishiId }: { rishiId: string }) {
  const [worlds, setWorlds] = useState<AdminWorld[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState('');
  const [veda, setVeda] = useState<VedaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [editZoneId, setEditZoneId] = useState<string | null>(null);
  const [editZoneName, setEditZoneName] = useState('');
  const [editZoneDesc, setEditZoneDesc] = useState('');
  const [editZoneContent, setEditZoneContent] = useState('');

  const [editEntityId, setEditEntityId] = useState<string | null>(null);
  const [editEntityName, setEditEntityName] = useState('');
  const [editEntityType, setEditEntityType] = useState('');
  const [editEntityDesc, setEditEntityDesc] = useState('');

  const [editLoreId, setEditLoreId] = useState<string | null>(null);
  const [editLoreTitle, setEditLoreTitle] = useState('');
  const [editLoreCategory, setEditLoreCategory] = useState('');
  const [editLoreContent, setEditLoreContent] = useState('');

  const headers = { 'Content-Type': 'application/json', 'X-Rishi-Id': rishiId };

  useEffect(() => {
    fetch(`${API}/api/admin/worlds`, { headers: { 'X-Rishi-Id': rishiId } })
      .then(r => r.json())
      .then(({ worlds: w }) => { setWorlds(w ?? []); if (w?.length) setSelectedWorldId(w[0].id); });
  }, [rishiId]);

  const loadVeda = useCallback(async (worldId: string) => {
    if (!worldId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/worlds/${worlds.find(w => w.id === worldId)?.slug}/veda`);
      const data = await res.json();
      setVeda({ zones: data.zones ?? [], entities: data.entities ?? [], lore: data.lore ?? [] });
    } catch {
      setError('Failed to load Veda.');
    } finally { setLoading(false); }
  }, [worlds]);

  useEffect(() => {
    if (selectedWorldId) loadVeda(selectedWorldId);
  }, [selectedWorldId, loadVeda]);

  async function saveZone(id: string) {
    await fetch(`${API}/api/admin/veda/zones/${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ name: editZoneName, description: editZoneDesc || null, rawContent: editZoneContent }),
    });
    setEditZoneId(null);
    await loadVeda(selectedWorldId);
  }

  async function deleteZone(id: string) {
    if (!confirm('Delete this zone?')) return;
    await fetch(`${API}/api/admin/veda/zones/${id}`, { method: 'DELETE', headers: { 'X-Rishi-Id': rishiId } });
    await loadVeda(selectedWorldId);
  }

  async function saveEntity(id: string) {
    await fetch(`${API}/api/admin/veda/entities/${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ name: editEntityName, description: editEntityDesc || null, entityType: editEntityType }),
    });
    setEditEntityId(null);
    await loadVeda(selectedWorldId);
  }

  async function deleteEntity(id: string) {
    if (!confirm('Delete this entity?')) return;
    await fetch(`${API}/api/admin/veda/entities/${id}`, { method: 'DELETE', headers: { 'X-Rishi-Id': rishiId } });
    await loadVeda(selectedWorldId);
  }

  async function saveLore(id: string) {
    await fetch(`${API}/api/admin/veda/lore/${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ title: editLoreTitle, category: editLoreCategory, content: editLoreContent }),
    });
    setEditLoreId(null);
    await loadVeda(selectedWorldId);
  }

  async function deleteLore(id: string) {
    if (!confirm('Delete this lore entry?')) return;
    await fetch(`${API}/api/admin/veda/lore/${id}`, { method: 'DELETE', headers: { 'X-Rishi-Id': rishiId } });
    await loadVeda(selectedWorldId);
  }

  return (
    <div>
      {error && <p style={{ color: 'var(--error, #c0392b)', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</p>}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={sectionHead}>Select World</label>
        <select style={{ ...inputSm, width: '260px' }} value={selectedWorldId} onChange={e => setSelectedWorldId(e.target.value)}>
          {worlds.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading Veda…</p>}

      {veda && !loading && (
        <>
          {/* Zones */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={sectionHead}>Zones ({veda.zones.length})</p>
            {veda.zones.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No zones yet.</p>}
            {veda.zones.map(z => (
              <div key={z.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '0.6rem 0.9rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--accent)' }}>{z.name}</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={mutedBtn} onClick={() => { setEditZoneId(z.id); setEditZoneName(z.name); setEditZoneDesc(z.description ?? ''); setEditZoneContent(z.rawContent); }}>Edit</button>
                    <button style={dangerBtn} onClick={() => deleteZone(z.id)}>Delete</button>
                  </div>
                </div>
                {editZoneId === z.id && (
                  <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <input style={inputSm} placeholder="Name" value={editZoneName} onChange={e => setEditZoneName(e.target.value)} />
                    <input style={inputSm} placeholder="Description" value={editZoneDesc} onChange={e => setEditZoneDesc(e.target.value)} />
                    <textarea style={{ ...inputSm, resize: 'vertical' }} rows={4} placeholder="Raw content" value={editZoneContent} onChange={e => setEditZoneContent(e.target.value)} />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={accentBtn} onClick={() => saveZone(z.id)}>Save</button>
                      <button style={mutedBtn} onClick={() => setEditZoneId(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Entities */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={sectionHead}>Entities ({veda.entities.length})</p>
            {veda.entities.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No entities yet.</p>}
            {veda.entities.map(e => (
              <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '0.6rem 0.9rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text)' }}>{e.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({e.entityType})</span></span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={mutedBtn} onClick={() => { setEditEntityId(e.id); setEditEntityName(e.name); setEditEntityType(e.entityType); setEditEntityDesc(e.description ?? ''); }}>Edit</button>
                    <button style={dangerBtn} onClick={() => deleteEntity(e.id)}>Delete</button>
                  </div>
                </div>
                {editEntityId === e.id && (
                  <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <input style={inputSm} placeholder="Name" value={editEntityName} onChange={e => setEditEntityName(e.target.value)} />
                    <input style={inputSm} placeholder="Type (NPC, CREATURE, etc.)" value={editEntityType} onChange={e => setEditEntityType(e.target.value)} />
                    <textarea style={{ ...inputSm, resize: 'vertical' }} rows={2} placeholder="Description" value={editEntityDesc} onChange={e => setEditEntityDesc(e.target.value)} />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={accentBtn} onClick={() => saveEntity(e.id)}>Save</button>
                      <button style={mutedBtn} onClick={() => setEditEntityId(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Lore */}
          <div>
            <p style={sectionHead}>Lore ({veda.lore.length})</p>
            {veda.lore.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No lore yet.</p>}
            {veda.lore.map(l => (
              <div key={l.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '0.6rem 0.9rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text)' }}>{l.title} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({l.category})</span></span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button style={mutedBtn} onClick={() => { setEditLoreId(l.id); setEditLoreTitle(l.title); setEditLoreCategory(l.category); setEditLoreContent(l.content); }}>Edit</button>
                    <button style={dangerBtn} onClick={() => deleteLore(l.id)}>Delete</button>
                  </div>
                </div>
                {editLoreId === l.id && (
                  <div style={{ marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <input style={inputSm} placeholder="Title" value={editLoreTitle} onChange={e => setEditLoreTitle(e.target.value)} />
                    <input style={inputSm} placeholder="Category (LAW, CULTURE, etc.)" value={editLoreCategory} onChange={e => setEditLoreCategory(e.target.value)} />
                    <textarea style={{ ...inputSm, resize: 'vertical' }} rows={4} placeholder="Content" value={editLoreContent} onChange={e => setEditLoreContent(e.target.value)} />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button style={accentBtn} onClick={() => saveLore(l.id)}>Save</button>
                      <button style={mutedBtn} onClick={() => setEditLoreId(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Characters Tab ────────────────────────────────────────────────────────────

function CharactersTab({ rishiId }: { rishiId: string }) {
  const [characters, setCharacters] = useState<AdminCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterWorldId, setFilterWorldId] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSpecies, setEditSpecies] = useState('');
  const [editRace, setEditRace] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editBackstory, setEditBackstory] = useState('');
  const [editTraits, setEditTraits] = useState('');

  const headers = { 'Content-Type': 'application/json', 'X-Rishi-Id': rishiId };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterUserId) params.set('userId', filterUserId);
      if (filterWorldId) params.set('worldId', filterWorldId);
      const { characters: c } = await fetch(`${API}/api/admin/characters?${params}`, { headers: { 'X-Rishi-Id': rishiId } }).then(r => r.json());
      setCharacters(c ?? []);
    } catch {
      setError('Failed to load characters.');
    } finally { setLoading(false); }
  }, [rishiId, filterUserId, filterWorldId]);

  async function deleteCharacter(id: string) {
    if (!confirm('Delete this character?')) return;
    const res = await fetch(`${API}/api/admin/characters/${id}`, { method: 'DELETE', headers: { 'X-Rishi-Id': rishiId } });
    if (!res.ok) { const e = await res.json(); setError(e.error); return; }
    await load();
  }

  async function saveEdit(id: string) {
    const res = await fetch(`${API}/api/admin/characters/${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({
        name: editName,
        species: editSpecies || null,
        race: editRace || null,
        gender: editGender || null,
        backstory: editBackstory || null,
        traits: editTraits.split(',').map(s => s.trim()).filter(Boolean),
      }),
    });
    if (!res.ok) { const e = await res.json(); setError(e.error); return; }
    setEditId(null);
    await load();
  }

  return (
    <div>
      {error && <p style={{ color: 'var(--error, #c0392b)', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <p style={sectionHead}>Filter by User ID</p>
          <input style={{ ...inputSm, width: '200px' }} placeholder="User ID" value={filterUserId} onChange={e => setFilterUserId(e.target.value)} />
        </div>
        <div>
          <p style={sectionHead}>Filter by World ID</p>
          <input style={{ ...inputSm, width: '200px' }} placeholder="World ID" value={filterWorldId} onChange={e => setFilterWorldId(e.target.value)} />
        </div>
        <button style={accentBtn} onClick={load}>Search</button>
      </div>

      {loading && <p style={{ color: 'var(--text-muted)' }}>Loading…</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {characters.map(c => (
          <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: '6px', padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{c.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.75rem' }}>
                  {c.user.username} · {c.world.name}
                </span>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  {[c.species, c.race, c.gender].filter(Boolean).join(' · ') || 'No details'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={mutedBtn} onClick={() => { setEditId(c.id); setEditName(c.name); setEditSpecies(c.species ?? ''); setEditRace(c.race ?? ''); setEditGender(c.gender ?? ''); setEditBackstory(''); setEditTraits(c.traits.join(', ')); }}>Edit</button>
                <button style={dangerBtn} onClick={() => deleteCharacter(c.id)}>Delete</button>
              </div>
            </div>

            {editId === c.id && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <input style={inputSm} placeholder="Name" value={editName} onChange={e => setEditName(e.target.value)} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input style={inputSm} placeholder="Species" value={editSpecies} onChange={e => setEditSpecies(e.target.value)} />
                  <input style={inputSm} placeholder="Race" value={editRace} onChange={e => setEditRace(e.target.value)} />
                  <input style={inputSm} placeholder="Gender" value={editGender} onChange={e => setEditGender(e.target.value)} />
                </div>
                <input style={inputSm} placeholder="Traits (comma-separated)" value={editTraits} onChange={e => setEditTraits(e.target.value)} />
                <textarea style={{ ...inputSm, resize: 'vertical' }} rows={2} placeholder="Backstory" value={editBackstory} onChange={e => setEditBackstory(e.target.value)} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button style={accentBtn} onClick={() => saveEdit(c.id)}>Save</button>
                  <button style={mutedBtn} onClick={() => setEditId(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {!loading && characters.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No characters found. Use the filters above and click Search.</p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'users' | 'worlds' | 'veda' | 'characters';

export default function RishiPage() {
  const [user, setUser] = useState<CurrentUser | null | 'loading'>('loading');
  const [tab, setTab] = useState<Tab>('users');

  useEffect(() => {
    fetchCurrentUser().then(setUser);
  }, []);

  if (user === 'loading') {
    return (
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </main>
    );
  }

  if (!user || user.role !== 'ADMIN') {
    return (
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>← Home</Link>
        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--error, #c0392b)', fontSize: '1.1rem' }}>Access denied.</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>This panel is restricted to Rishis.</p>
        </div>
      </main>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'users', label: 'Users' },
    { key: 'worlds', label: 'Worlds' },
    { key: 'veda', label: 'Veda' },
    { key: 'characters', label: 'Characters' },
  ];

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', color: 'var(--warning, #e8a838)', margin: 0 }}>Rishi Panel</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>Signed in as {user.username}</p>
        </div>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>← Home</Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {tabs.map(t => (
          <button key={t.key} style={tabBtn(tab === t.key)} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'users' && <UsersTab rishiId={user.id} />}
      {tab === 'worlds' && <WorldsTab rishiId={user.id} />}
      {tab === 'veda' && <VedaTab rishiId={user.id} />}
      {tab === 'characters' && <CharactersTab rishiId={user.id} />}
    </main>
  );
}
