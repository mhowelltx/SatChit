'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchCurrentUser, clearStoredUserId, onAuthChange, type CurrentUser } from '@/lib/auth';

export default function NavBar() {
  const [user, setUser] = useState<CurrentUser | null | 'loading'>('loading');

  async function refresh() {
    const u = await fetchCurrentUser();
    setUser(u);
  }

  useEffect(() => {
    refresh();
    // Keep in sync when any component fires storeUserId / clearStoredUserId
    return onAuthChange(refresh);
  }, []);

  function signOut() {
    clearStoredUserId();
    setUser(null);
  }

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.6rem 1.5rem',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.82rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left — logo */}
      <Link
        href="/"
        style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 'bold', letterSpacing: '0.05em' }}
      >
        Veda World Song
      </Link>

      {/* Right — auth state */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user === 'loading' ? (
          <span style={{ color: 'var(--text-muted)' }}>…</span>
        ) : user ? (
          <>
            {user.role === 'ADMIN' && (
              <Link
                href="/rishi"
                style={{ color: 'var(--warning, #e8a838)', textDecoration: 'none', fontSize: '0.78rem' }}
                title="Rishi panel"
              >
                Rishi
              </Link>
            )}
            <Link
              href="/profile"
              style={{ color: 'var(--text)', textDecoration: 'none' }}
              title="View profile"
            >
              {user.username}
            </Link>
            <button
              onClick={signOut}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                borderRadius: '4px',
                padding: '0.2rem 0.65rem',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link
            href="/"
            style={{
              color: 'var(--accent)',
              textDecoration: 'none',
              border: '1px solid var(--accent)',
              borderRadius: '4px',
              padding: '0.2rem 0.75rem',
            }}
          >
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
