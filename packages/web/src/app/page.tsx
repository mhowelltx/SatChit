import Link from 'next/link';

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <pre
        style={{
          color: 'var(--accent)',
          fontSize: '0.8rem',
          lineHeight: 1.2,
          marginBottom: '2rem',
          userSelect: 'none',
        }}
      >{`
 ____        _   ____ _     _ _
/ ___|  __ _| |_/ ___| |__ (_) |_
\\___ \\ / _\` | __\\___ \\ '_ \\| | __|
 ___) | (_| | |_ ___) | | | | | |_
|____/ \\__,_|\\__|____/|_| |_|_|\\__|
`}</pre>

      <p
        style={{
          maxWidth: '480px',
          color: 'var(--text-muted)',
          marginBottom: '2.5rem',
          fontSize: '1rem',
        }}
      >
        Explore AI-generated worlds shaped by consciousness and existence.
        <br />
        Every step you take writes the world into being.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href="/worlds"
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: '4px',
            fontWeight: 'bold',
          }}
        >
          Explore Worlds
        </Link>
        <Link
          href="/worlds/create"
          style={{
            padding: '0.75rem 1.5rem',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            borderRadius: '4px',
          }}
        >
          Create a World
        </Link>
      </div>
    </main>
  );
}
