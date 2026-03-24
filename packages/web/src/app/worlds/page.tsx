import Link from 'next/link';

async function getWorlds() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${apiUrl}/api/worlds`, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    const data = await res.json() as { worlds: Array<{ id: string; name: string; slug: string; description: string; createdAt: string }> };
    return data.worlds;
  } catch {
    return [];
  }
}

export default async function WorldsPage() {
  const worlds = await getWorlds();

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1 style={{ margin: 0, color: 'var(--accent)' }}>Worlds</h1>
        <Link
          href="/worlds/create"
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            borderRadius: '4px',
            fontSize: '0.9rem',
          }}
        >
          + Create World
        </Link>
      </div>

      {worlds.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            padding: '4rem 0',
            border: '1px dashed var(--border)',
            borderRadius: '8px',
          }}
        >
          <p>No worlds yet. Be the first to create one.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {worlds.map((world) => (
            <Link
              key={world.id}
              href={`/worlds/${world.slug}`}
              style={{
                display: 'block',
                padding: '1.25rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'inherit',
                textDecoration: 'none',
              }}
            >
              <h2 style={{ margin: '0 0 0.5rem', color: 'var(--accent)', fontSize: '1.1rem' }}>
                {world.name}
              </h2>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                {world.description}
              </p>
              <span
                style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'block' }}
              >
                Created {new Date(world.createdAt).toLocaleDateString()}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
