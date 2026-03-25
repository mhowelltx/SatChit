'use client';

import { Suspense, useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { fetchCurrentUser, type CurrentUser } from '@/lib/auth';
import AuthForm from '@/components/AuthForm';
import type {
  WorldCharacterTemplate,
  TemplateAttribute,
  TemplateStat,
} from '@satchit/shared';

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
  customAttributes: Record<string, unknown>;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const fieldStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1rem' };
const labelStyle: React.CSSProperties = { color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' };
const inputStyle: React.CSSProperties = { width: '100%', fontSize: '0.9rem' };
const row3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' };
const sectionHead: React.CSSProperties = { color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '1.5rem 0 1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.35rem' };

function DynamicField({ attr, value, onChange }: {
  attr: TemplateAttribute;
  value: unknown;
  onChange: (key: string, val: unknown) => void;
}) {
  const strVal = (value ?? '') as string;
  const arrVal = (Array.isArray(value) ? value : []) as string[];

  return (
    <div style={fieldStyle}>
      <label style={labelStyle} title={attr.description}>{attr.label}{attr.required ? ' *' : ''}</label>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: '-0.2rem', marginBottom: '0.15rem' }}>{attr.description}</span>

      {attr.type === 'text' && (
        <input style={inputStyle} value={strVal} placeholder={attr.placeholder ?? ''} required={attr.required}
          onChange={(e) => onChange(attr.key, e.target.value)} />
      )}
      {attr.type === 'textarea' && (
        <textarea rows={3} style={{ ...inputStyle, resize: 'vertical' }} value={strVal} placeholder={attr.placeholder ?? ''} required={attr.required}
          onChange={(e) => onChange(attr.key, e.target.value)} />
      )}
      {attr.type === 'number' && (
        <input type="number" style={inputStyle} value={strVal} min={attr.min} max={attr.max} placeholder={attr.placeholder ?? ''}
          onChange={(e) => onChange(attr.key, e.target.value ? Number(e.target.value) : '')} />
      )}
      {attr.type === 'select' && (
        <select style={inputStyle} value={strVal} required={attr.required} onChange={(e) => onChange(attr.key, e.target.value)}>
          <option value="">{attr.placeholder ?? 'Select…'}</option>
          {(attr.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      )}
      {attr.type === 'multiselect' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {(attr.options ?? []).map((opt) => {
            const selected = arrVal.includes(opt);
            return (
              <button key={opt} type="button"
                onClick={() => onChange(attr.key, selected ? arrVal.filter((v) => v !== opt) : [...arrVal, opt])}
                style={{ border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`, background: selected ? 'var(--accent)' : 'transparent', color: selected ? '#fff' : 'var(--text-muted)', borderRadius: '4px', padding: '0.25rem 0.65rem', fontSize: '0.8rem' }}>
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatField({ stat, value, onChange }: { stat: TemplateStat; value: number; onChange: (key: string, val: number) => void }) {
  return (
    <div style={{ ...fieldStyle, marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={labelStyle} title={stat.description}>{stat.label}</label>
        <span style={{ color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 'bold' }}>{value}</span>
      </div>
      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.3rem' }}>{stat.description}</span>
      <input type="range" min={stat.min} max={stat.max} value={value} style={{ width: '100%' }}
        onChange={(e) => onChange(stat.key, Number(e.target.value))} />
    </div>
  );
}

function AffinityPicker({ affinities, selected, onChange }: { affinities: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
      {affinities.map((a) => {
        const on = selected.includes(a);
        return (
          <button key={a} type="button"
            onClick={() => onChange(on ? selected.filter((x) => x !== a) : [...selected, a])}
            style={{ border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'transparent', color: on ? '#fff' : 'var(--text-muted)', borderRadius: '4px', padding: '0.25rem 0.65rem', fontSize: '0.8rem' }}>
            {a}
          </button>
        );
      })}
    </div>
  );
}

function CharactersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get('characterId');

  const [loading, setLoading] = useState(true);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [world, setWorld] = useState<World | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [template, setTemplate] = useState<WorldCharacterTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [race, setRace] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [physicalDescription, setPhysicalDescription] = useState('');
  const [traitsInput, setTraitsInput] = useState('');
  const [backstory, setBackstory] = useState('');
  const [customAttributes, setCustomAttributes] = useState<Record<string, unknown>>({});
  const [stats, setStats] = useState<Record<string, number>>({});
  const [selectedAffinities, setSelectedAffinities] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/worlds/${slug}`).then((r) => r.json()),
      fetchCurrentUser(),
    ])
      .then(([worldData, u]) => {
        setWorld(worldData.world ?? null);
        setUser(u);
        if (u && worldData.world) return loadCharacters(u.id, worldData.world.id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showForm || template || !slug) return;
    setTemplateLoading(true);
    fetch(`${API}/api/worlds/${slug}/character-template`)
      .then((r) => r.json())
      .then((data: { template?: WorldCharacterTemplate }) => {
        if (data.template) {
          setTemplate(data.template);
          const defaults: Record<string, number> = {};
          for (const s of data.template.stats ?? []) defaults[s.key] = s.default;
          setStats(defaults);
        }
      })
      .catch(console.error)
      .finally(() => setTemplateLoading(false));
  }, [showForm, template, slug]);

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

  async function handleAuth(u: CurrentUser) {
    setUser(u);
    if (world) await loadCharacters(u.id, world.id);
  }

  function setCustomAttr(key: string, val: unknown) {
    setCustomAttributes((prev) => ({ ...prev, [key]: val }));
  }

  function setStat(key: string, val: number) {
    setStats((prev) => ({ ...prev, [key]: val }));
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
          abilities: selectedAffinities,
          backstory: backstory.trim() || null,
          stats,
          customAttributes,
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
      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem' }}>
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

      {!user && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <AuthForm onAuth={handleAuth} context="Sign in to create or choose a character." />
        </div>
      )}

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
                    style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.45rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Embody
                  </button>
                </div>
              ))}
            </section>
          )}

          {!showForm && (
            <button onClick={() => setShowForm(true)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '4px', padding: '0.5rem 1.25rem', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
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

              <div style={row3}>
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

              <div style={{ ...row3, gridTemplateColumns: '1fr 2fr' }}>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Age</label>
                  <input type="number" min={0} style={inputStyle} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 28" />
                </div>
                <div style={fieldStyle}>
                  <label style={labelStyle}>Traits</label>
                  <input style={inputStyle} value={traitsInput} onChange={(e) => setTraitsInput(e.target.value)}
                    placeholder={template?.traitSuggestions?.slice(0, 3).join(', ') ?? 'curious, patient, skeptical'} />
                  {template?.traitSuggestions && template.traitSuggestions.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                      {template.traitSuggestions.map((t) => (
                        <button key={t} type="button"
                          onClick={() => {
                            const current = traitsInput.split(',').map((x) => x.trim()).filter(Boolean);
                            if (!current.includes(t)) setTraitsInput([...current, t].join(', '));
                          }}
                          style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', borderRadius: '4px', padding: '0.15rem 0.5rem', fontSize: '0.72rem' }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
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

              {templateLoading && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '1.25rem 0' }}>
                  Generating {world?.name} character fields…
                </p>
              )}

              {template && !templateLoading && (
                <>
                  {template.factions?.length > 0 && (
                    <>
                      <p style={sectionHead}>Cultural Affiliation</p>
                      <DynamicField
                        attr={{ key: '_faction', label: 'Faction', type: 'select', description: 'Which cultural group do you belong to?', options: template.factions.map((f) => f.name), placeholder: 'Choose your people…' }}
                        value={customAttributes['_faction']}
                        onChange={setCustomAttr}
                      />
                      {customAttributes['_faction'] && (
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', margin: '-0.5rem 0 1rem' }}>
                          {template.factions.find((f) => f.name === customAttributes['_faction'])?.description}
                        </p>
                      )}
                    </>
                  )}

                  {template.customAttributes?.length > 0 && (
                    <>
                      <p style={sectionHead}>Character Details</p>
                      {template.customAttributes.map((attr) => (
                        <DynamicField key={attr.key} attr={attr} value={customAttributes[attr.key]} onChange={setCustomAttr} />
                      ))}
                    </>
                  )}

                  {template.affinities?.length > 0 && (
                    <>
                      <p style={sectionHead}>Affinities</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '-0.5rem 0 0.75rem' }}>
                        Choose the abilities and bonds that define your character.
                      </p>
                      <AffinityPicker affinities={template.affinities} selected={selectedAffinities} onChange={setSelectedAffinities} />
                    </>
                  )}

                  {template.stats?.length > 0 && (
                    <>
                      <p style={sectionHead}>Starting Stats</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
                        {template.stats.map((s) => (
                          <StatField key={s.key} stat={s} value={stats[s.key] ?? s.default} onChange={setStat} />
                        ))}
                      </div>
                    </>
                  )}

                  {template.skillCategories?.length > 0 && (
                    <>
                      <p style={sectionHead}>Skills</p>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '-0.5rem 0 0.75rem' }}>
                        Skills develop through play. Note any you start with.
                      </p>
                      {template.skillCategories.map((cat) => (
                        <div key={cat.key} style={fieldStyle}>
                          <label style={labelStyle}>{cat.label}</label>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: '0.2rem' }}>
                            {cat.description} — e.g. {cat.examples.join(', ')}
                          </span>
                          <input style={inputStyle} placeholder="skill: level, skill: level"
                            value={(customAttributes[`_skills_${cat.key}`] as string) ?? ''}
                            onChange={(e) => setCustomAttr(`_skills_${cat.key}`, e.target.value)} />
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}

              {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', margin: '0 0 1rem' }}>{error}</p>}

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '1.25rem' }}>
                <button type="submit" disabled={submitting || !name.trim()} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.6rem 1.5rem', fontSize: '0.9rem', opacity: submitting ? 0.6 : 1 }}>
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
    <Suspense fallback={<main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem' }}><p style={{ color: 'var(--text-muted)' }}>Loading…</p></main>}>
      <CharactersPage params={params} />
    </Suspense>
  );
}
