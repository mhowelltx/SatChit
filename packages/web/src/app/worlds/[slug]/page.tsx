import Link from 'next/link';

interface World {
  id: string;
  name: string;
  slug: string;
  description: string;
  visibility: string;
  foundationalLaws: string[];
  culturalTypologies: string[];
  createdAt: string;
}

async function getWorld(slug: string): Promise<World | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${apiUrl}/api/worlds/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json() as { world: World };
    return data.world;
  } catch {
    return null;
  }
}

export default async function WorldDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const world = await getWorld(slug);

  if (!world) {
    return (
      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>World not found.</p>
        <Link href="/worlds" style={{ color: 'var(--accent)' }}>Back to worlds</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem' }}>
      <Link href="/worlds" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        ← Worlds
      </Link>

      <h1 style={{ color: 'var(--accent)', marginTop: '1rem' }}>{world.name}</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{world.description}</p>

      <Link
        href={`/worlds/${world.slug}/characters`}
        style={{
          display: 'inline-block',
          padding: '0.75rem 2rem',
          background: 'var(--accent)',
          color: '#fff',
          borderRadius: '4px',
          fontWeight: 'bold',
          fontSize: '1rem',
        }}
      >
        Enter World
      </Link>
    </main>
  );
}
