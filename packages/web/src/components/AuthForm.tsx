'use client';

import { useState } from 'react';
import { register, login, type CurrentUser } from '@/lib/auth';

interface Props {
  onAuth: (user: CurrentUser) => void;
  /** If set, the form shows a heading linking back to the world context */
  context?: string;
}

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  marginBottom: '1rem',
};
const labelStyle: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
};
const inputStyle: React.CSSProperties = { width: '100%', fontSize: '0.9rem' };

export default function AuthForm({ onAuth, context }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result =
        mode === 'register'
          ? await register(username, password)
          : await login(username, password);
      if (result.error !== null) {
        setError(result.error);
      } else {
        onAuth(result.user);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: '340px' }}>
      {context && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>
          {context}
        </p>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        {(['login', 'register'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); }}
            style={{
              background: 'none',
              border: 'none',
              padding: '0 0 0.25rem',
              fontSize: '0.9rem',
              color: mode === m ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: mode === m ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {m === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={fieldStyle}>
          <label style={labelStyle}>Username</label>
          <input
            required
            autoFocus
            style={inputStyle}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="yourname"
            autoComplete={mode === 'register' ? 'username' : 'username'}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Password</label>
          <input
            required
            type="password"
            style={inputStyle}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={6}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          />
        </div>

        {error && (
          <p style={{ color: 'var(--error)', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || !username.trim() || !password}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '0.55rem 1.5rem',
            fontSize: '0.9rem',
            opacity: submitting ? 0.6 : 1,
            width: '100%',
          }}
        >
          {submitting ? '…' : mode === 'register' ? 'Create Account' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
