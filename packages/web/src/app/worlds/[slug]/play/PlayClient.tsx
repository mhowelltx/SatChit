'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  NarrationPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  VedaUpdatePayload,
  ErrorPayload,
} from '@satchit/shared';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface LogEntry {
  id: string;
  type: 'narration' | 'input' | 'system' | 'error' | 'veda';
  text: string;
  timestamp: string;
}

interface PlayClientProps {
  worldSlug: string;
  characterId: string | null;
}

// Placeholder until auth is implemented
const PLACEHOLDER_WORLD_ID = 'placeholder-world-id';
const PLACEHOLDER_PLAYER_ID = 'placeholder-player-id';
const PLACEHOLDER_SESSION_ID = 'placeholder-session-id';

export default function PlayClient({ worldSlug, characterId }: PlayClientProps) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [zoneSlug, setZoneSlug] = useState<string | null>(null);
  const socketRef = useRef<AppSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>(PLACEHOLDER_SESSION_ID);

  const addLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLog((prev) => [
      ...prev,
      { ...entry, id: `${Date.now()}-${Math.random()}` },
    ]);
  }, []);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
    const socket: AppSocket = io(wsUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      addLog({ type: 'system', text: 'Connected to server. Entering world…', timestamp: new Date().toISOString() });

      socket.emit('session:join', {
        worldId: '',
        worldSlug,
        playerId: PLACEHOLDER_PLAYER_ID,
        ...(characterId ? { characterId } : {}),
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      addLog({ type: 'system', text: 'Disconnected from server.', timestamp: new Date().toISOString() });
    });

    socket.on('world:narration', (payload: NarrationPayload) => {
      setZoneSlug(payload.zoneSlug);
      sessionId.current = payload.sessionId;
      addLog({ type: 'narration', text: payload.text, timestamp: payload.timestamp });
    });

    socket.on('player:joined', (payload: PlayerJoinedPayload) => {
      addLog({
        type: 'system',
        text: `${payload.username} has entered ${payload.zoneSlug}.`,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('player:left', (payload: PlayerLeftPayload) => {
      addLog({
        type: 'system',
        text: `${payload.username} has left.`,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('veda:update', (payload: VedaUpdatePayload) => {
      addLog({
        type: 'veda',
        text: `[Veda] New ${payload.type} discovered and recorded.`,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('session:error', (payload: ErrorPayload) => {
      addLog({ type: 'error', text: `Error: ${payload.message}`, timestamp: new Date().toISOString() });
    });

    return () => {
      socket.disconnect();
    };
  }, [addLog]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !socketRef.current) return;

    addLog({ type: 'input', text: `> ${trimmed}`, timestamp: new Date().toISOString() });

    socketRef.current.emit('player:action', {
      sessionId: sessionId.current,
      input: trimmed,
    });

    setInput('');
  }

  const textColor: Record<LogEntry['type'], string> = {
    narration: 'var(--text)',
    input: 'var(--accent)',
    system: 'var(--text-muted)',
    error: 'var(--error)',
    veda: 'var(--warning)',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        maxWidth: '800px',
        margin: '0 auto',
        padding: '1rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border)',
          marginBottom: '1rem',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href={`/worlds/${worldSlug}/characters`} style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            ← characters
          </Link>
          <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{worldSlug}</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link
            href={`/worlds/${worldSlug}/veda`}
            target="_blank"
            style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}
          >
            Veda ↗
          </Link>
          {zoneSlug && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {zoneSlug}
            </span>
          )}
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: connected ? 'var(--success)' : 'var(--error)',
              display: 'inline-block',
            }}
          />
        </div>
      </div>

      {/* Log */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          marginBottom: '1rem',
          lineHeight: 1.7,
        }}
      >
        {log.map((entry) => (
          <div
            key={entry.id}
            style={{
              color: textColor[entry.type],
              marginBottom: '0.75rem',
              whiteSpace: 'pre-wrap',
              fontSize: entry.type === 'system' || entry.type === 'veda' ? '0.85rem' : '0.95rem',
            }}
          >
            {entry.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <span style={{ color: 'var(--accent)', lineHeight: '2.2rem' }}>{'>'}</span>
        <input
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            borderRadius: 0,
            color: 'var(--accent)',
            fontSize: '0.95rem',
            padding: '0.4rem 0',
            outline: 'none',
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={connected ? 'What do you do?' : 'Connecting…'}
          disabled={!connected}
          autoFocus
        />
        <button
          type="submit"
          disabled={!connected || !input.trim()}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
            borderRadius: '4px',
            padding: '0.4rem 0.75rem',
            fontSize: '0.85rem',
          }}
        >
          Enter
        </button>
      </form>
    </div>
  );
}
