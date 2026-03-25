'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchCurrentUser, type CurrentUser } from '@/lib/auth';
import AuthForm from '@/components/AuthForm';

const logo = `
 ____        _   ____ _     _ _
/ ___|  __ _| |_/ ___| |__ (_) |_
\\___ \\ / _\` | __\\___ \\ '_ \\| | __|
 ___) | (_| | |_ ___) | | | | | |_
|____/ \\__,_|\\__|____/|_| |_|_|\\__|
`;

export default function HomePage() {
  const [user, setUser] = useState<CurrentUser | null | 'loading'>('loading');

  useEffect(() => {
    fetchCurrentUser().then(setUser);
  }, []);

  function handleAuth(u: CurrentUser) {
    setUser(u);
  }

  // Shared logo/tagline block
  const header = (
    <>
      <pre
        style={{
          color: 'var(--accent)',
          fontSize: '0.8rem',
          lineHeight: 1.2,
          marginBottom: '2rem',
          userSelect: 'none',
        }}
      >
        {logo}
      </pre>
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
    </>
  );

  if (user === 'loading') {
    return (
      <main style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        {header}
      </main>
    );
  }

  if (!user) {
    return (
      <main style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        {header}
        <div style={{ textAlign: 'left' }}>
          <AuthForm onAuth={handleAuth} context="Sign in or create an account to begin." />
        </div>
      </main>
    );
  }

  // Logged in
  return (
    <main style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      {header}

      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
        Welcome back,{' '}
        <Link href="/profile" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
          {user.username}
        </Link>
        .
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href="/worlds"
          style={{ padding: '0.75rem 1.5rem', background: 'var(--accent)', color: '#fff', borderRadius: '4px', fontWeight: 'bold', textDecoration: 'none' }}
        >
          Explore Worlds
        </Link>
        <Link
          href="/worlds/create"
          style={{ padding: '0.75rem 1.5rem', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: '4px', textDecoration: 'none' }}
        >
          Create a World
        </Link>
      </div>
    </main>
  );
}
