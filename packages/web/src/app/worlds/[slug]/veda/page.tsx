import Link from 'next/link';

interface VedaZone {
  id: string;
  slug: string;
  name: string;
  description: string;
  rawContent: string;
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

interface VedaData {
  zones: VedaZone[];
  entities: VedaEntity[];
  lore: VedaLore[];
  recentEvents: VedaEvent[];
}

async function getVeda(slug: string): Promise<VedaData | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${apiUrl}/api/worlds/${slug}/veda`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json() as Promise<VedaData>;
  } catch {
    return null;
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

export default async function VedaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const veda = await getVeda(slug);

  if (!veda) {
    return (
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Veda not found.</p>
        <Link href={`/worlds/${slug}`} style={{ color: 'var(--accent)' }}>Back to world</Link>
      </main>
    );
  }

  const { zones, entities, lore, recentEvents } = veda;
  const counts = [
    `${zones.length} zone${zones.length !== 1 ? 's' : ''}`,
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
        <Link href={`/worlds/${slug}/play`} style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>
          Enter World →
        </Link>
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

      {/* Entities */}
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
