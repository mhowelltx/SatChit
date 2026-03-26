'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { getStoredUserId } from '@/lib/auth';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  NarrationPayload,
  PlayerJoinedPayload,
  PlayerLeftPayload,
  PlayerMovedPayload,
  VedaUpdatePayload,
  ErrorPayload,
  ZonePresencePayload,
  PlayerActionEchoPayload,
  ZoneChatPayload,
  NameMention,
  SessionInfoPayload,
} from '@satchit/shared';
import type { VedaZone } from '@satchit/shared';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface LogEntry {
  id: string;
  type: 'narration' | 'input' | 'system' | 'error' | 'veda' | 'action-echo' | 'chat';
  text: string;
  timestamp: string;
  suggestions?: string[];
  mentions?: NameMention[];
  /** Attribution for action-echo and chat entries */
  authorName?: string;
}

interface ZonePlayer {
  playerId: string;
  username: string;
}

interface PlayClientProps {
  worldSlug: string;
  characterId: string | null;
  targetZoneSlug?: string | null;
}

const PLACEHOLDER_SESSION_ID = 'placeholder-session-id';

// ── NarrationText: renders narration with markdown emphasis + colour-coded names ──

const MENTION_COLORS: Record<NameMention['type'], string> = {
  npc: 'var(--warning)',      // amber — NPCs
  pc: 'var(--success)',       // green — player characters
  rishi: '#FFD700',           // gold  — Rishi avatars
};

const DISPOSITION_COLORS: Record<string, string> = {
  friendly: 'var(--success)',
  neutral: 'var(--text-muted)',
  wary: 'var(--warning)',
  hostile: 'var(--error)',
  unknown: 'var(--border)',
};

function parseInlineMarkdown(text: string): React.ReactNode[] {
  // Handles **bold** and *italic* (non-greedy, single-pass)
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2] !== undefined) {
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      parts.push(<em key={match.index}>{match[3]}</em>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function NarrationText({ text, mentions }: { text: string; mentions?: NameMention[] }) {
  if (!mentions || mentions.length === 0) {
    return <>{parseInlineMarkdown(text)}</>;
  }

  // Build colour map, sort names longest-first to avoid partial matches
  const colorMap: Record<string, string> = {};
  for (const m of mentions) {
    colorMap[m.name] = MENTION_COLORS[m.type];
  }
  const sortedNames = Object.keys(colorMap).sort((a, b) => b.length - a.length);
  const escaped = sortedNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const namePattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'g');

  const segments: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = namePattern.exec(text)) !== null) {
    if (m.index > lastIdx) {
      segments.push(...parseInlineMarkdown(text.slice(lastIdx, m.index)));
    }
    segments.push(
      <span key={m.index} style={{ color: colorMap[m[0]], fontWeight: 600 }}>
        {m[0]}
      </span>,
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    segments.push(...parseInlineMarkdown(text.slice(lastIdx)));
  }

  return <>{segments}</>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlayClient({ worldSlug, characterId, targetZoneSlug }: PlayClientProps) {
  const router = useRouter();
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [zoneSlug, setZoneSlug] = useState<string | null>(null);
  const [atmosphereTags, setAtmosphereTags] = useState<string[]>([]);
  const [recentZones, setRecentZones] = useState<string[]>([]);
  const [zonePlayers, setZonePlayers] = useState<ZonePlayer[]>([]);
  // Session identity
  const [worldName, setWorldName] = useState<string>(worldSlug);
  const [characterName, setCharacterName] = useState<string | null>(null);
  // Zone NPC list with disposition + relationship score
  const [zoneNpcs, setZoneNpcs] = useState<Array<{ name: string; disposition: string; relationshipScore?: number }>>([]);
  // Mini zone map state
  const [mapZones, setMapZones] = useState<Array<{ slug: string; name: string }>>([]);
  const [mapEdges, setMapEdges] = useState<Array<{ from: string; to: string }>>([]);
  const socketRef = useRef<AppSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionId = useRef<string>(PLACEHOLDER_SESSION_ID);
  // Keep a ref to zoneSlug so event handlers can read the latest value
  const zoneSlugRef = useRef<string | null>(null);

  const addLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLog((prev) => [
      ...prev,
      { ...entry, id: `${Date.now()}-${Math.random()}` },
    ]);
  }, []);

  const submitInput = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !socketRef.current) return;

      if (trimmed.startsWith('"')) {
        // Direct zone chat — server echoes back to everyone including sender
        const message = trimmed.slice(1).trim();
        if (!message) return;
        socketRef.current.emit('zone:chat', {
          sessionId: sessionId.current,
          message,
        });
      } else {
        // Player action — triggers AI narration
        addLog({ type: 'input', text: `> ${trimmed}`, timestamp: new Date().toISOString() });
        socketRef.current.emit('player:action', {
          sessionId: sessionId.current,
          input: trimmed,
        });
      }
      setInput('');
    },
    [addLog],
  );

  const handleDisembody = useCallback(() => {
    socketRef.current?.disconnect();
    router.push('/worlds');
  }, [router]);

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
        playerId: getStoredUserId() ?? 'placeholder-player-id',
        ...(characterId ? { characterId } : {}),
        ...(targetZoneSlug ? { targetZoneSlug } : {}),
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setZonePlayers([]);
      addLog({ type: 'system', text: 'Disconnected from server.', timestamp: new Date().toISOString() });
    });

    socket.on('session:info', (payload: SessionInfoPayload) => {
      setWorldName(payload.worldName);
      setCharacterName(payload.characterName);
      setMapZones(payload.mapZones);
      setMapEdges(payload.mapEdges);
    });

    socket.on('world:narration', (payload: NarrationPayload) => {
      setZoneSlug(payload.zoneSlug);
      zoneSlugRef.current = payload.zoneSlug;
      sessionId.current = payload.sessionId;

      // Update atmosphere tags and breadcrumb trail when zone changes
      if (payload.atmosphereTags) {
        setAtmosphereTags(payload.atmosphereTags);
      }
      if (payload.zoneNpcs) {
        setZoneNpcs(payload.zoneNpcs);
      }
      setRecentZones((prev) => {
        const next = prev.filter((z) => z !== payload.zoneSlug);
        next.push(payload.zoneSlug);
        return next.slice(-5);
      });

      addLog({
        type: 'narration',
        text: payload.text,
        timestamp: payload.timestamp,
        suggestions: payload.suggestions,
        mentions: payload.mentions,
      });
    });

    socket.on('player:joined', (payload: PlayerJoinedPayload) => {
      setZonePlayers((prev) => {
        if (prev.some(p => p.playerId === payload.playerId)) return prev;
        return [...prev, { playerId: payload.playerId, username: payload.username }];
      });
      addLog({
        type: 'system',
        text: `${payload.username} has entered ${payload.zoneSlug}.`,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('player:left', (payload: PlayerLeftPayload) => {
      setZonePlayers((prev) => prev.filter(p => p.playerId !== payload.playerId));
      addLog({
        type: 'system',
        text: `${payload.username} has left.`,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('player:moved', (payload: PlayerMovedPayload) => {
      const currentZone = zoneSlugRef.current;
      setZonePlayers((prev) => {
        let updated = prev.filter(p => p.playerId !== payload.playerId);
        if (payload.toZoneSlug === currentZone) {
          updated = [...updated, { playerId: payload.playerId, username: payload.username }];
        }
        return updated;
      });
      addLog({
        type: 'system',
        text: `${payload.username} moved to ${payload.toZoneSlug}.`,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('zone:presence', (payload: ZonePresencePayload) => {
      setZonePlayers(payload.players);
    });

    socket.on('player:action:echo', (payload: PlayerActionEchoPayload) => {
      addLog({
        type: 'action-echo',
        text: payload.input,
        authorName: payload.username,
        timestamp: payload.timestamp,
      });
    });

    socket.on('zone:chat', (payload: ZoneChatPayload) => {
      addLog({
        type: 'chat',
        text: payload.message,
        authorName: payload.username,
        timestamp: payload.timestamp,
      });
    });

    socket.on('veda:update', (payload: VedaUpdatePayload) => {
      if (payload.type === 'zone') {
        const z = payload.data as VedaZone;
        setMapZones(prev => prev.some(n => n.slug === z.slug) ? prev : [...prev, { slug: z.slug, name: z.name }]);
      }
      if (payload.type === 'edge') {
        const e = payload.data as { fromZoneSlug: string; toZoneSlug: string };
        setMapEdges(prev =>
          prev.some(x => x.from === e.fromZoneSlug && x.to === e.toZoneSlug)
            ? prev
            : [...prev, { from: e.fromZoneSlug, to: e.toZoneSlug }],
        );
      }
      if (payload.type !== 'edge') {
        addLog({
          type: 'veda',
          text: `[Veda] New ${payload.type} discovered and recorded.`,
          timestamp: new Date().toISOString(),
        });
      }
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
    submitInput(input);
  }

  const textColor: Record<LogEntry['type'], string> = {
    narration: 'var(--text)',
    input: 'var(--accent)',
    system: 'var(--text-muted)',
    error: 'var(--error)',
    veda: 'var(--warning)',
    'action-echo': 'var(--text-muted)',
    chat: 'var(--success)',
  };

  // Find the last narration entry index for suggestions display
  const lastNarrationIdx = log.reduce((acc, entry, idx) =>
    entry.type === 'narration' ? idx : acc, -1);

  // Mini zone map: radial BFS layout
  const mapLayout = useMemo(() => {
    const W = 160, H = 120, cx = W / 2, cy = H / 2;
    if (mapZones.length === 0) return { nodes: [] as Array<{ slug: string; name: string; x: number; y: number }>, edges: mapEdges };
    const root = mapZones.find(z => z.slug === zoneSlug) ?? mapZones[0];
    const positions: Record<string, { x: number; y: number }> = {};
    const visited = new Set<string>();
    const queue: Array<{ slug: string; depth: number; angle: number; spread: number }> = [
      { slug: root.slug, depth: 0, angle: 0, spread: Math.PI * 2 },
    ];
    const radii = [0, 40, 72];
    while (queue.length) {
      const { slug, depth, angle, spread } = queue.shift()!;
      if (visited.has(slug)) continue;
      visited.add(slug);
      const r = radii[Math.min(depth, radii.length - 1)];
      positions[slug] = depth === 0
        ? { x: cx, y: cy }
        : { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
      const children = mapEdges
        .filter(e => e.from === slug || e.to === slug)
        .map(e => (e.from === slug ? e.to : e.from))
        .filter(s => !visited.has(s));
      children.forEach((child, i) => {
        const childAngle = angle - spread / 2 + (spread / Math.max(1, children.length)) * (i + 0.5);
        queue.push({ slug: child, depth: depth + 1, angle: childAngle, spread: spread / 2 });
      });
    }
    let unx = 8;
    mapZones.forEach(z => {
      if (!positions[z.slug]) { positions[z.slug] = { x: unx, y: H - 10 }; unx += 24; }
    });
    return {
      nodes: mapZones.map(z => ({ ...z, ...(positions[z.slug] ?? { x: cx, y: cy }) })),
      edges: mapEdges,
    };
  }, [mapZones, mapEdges, zoneSlug]);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '1rem',
        gap: '1rem',
      }}
    >
      {/* ── Main chat column ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border)',
            marginBottom: '1rem',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Link
                href={`/worlds/${worldSlug}/veda`}
                target="_blank"
                style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}
              >
                Veda ↗
              </Link>
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
          {log.map((entry, idx) => {
            const isLastNarration = idx === lastNarrationIdx;

            return (
              <div
                key={entry.id}
                style={{
                  color: textColor[entry.type],
                  marginBottom: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  fontSize: entry.type === 'system' || entry.type === 'veda' ? '0.85rem' : '0.95rem',
                }}
              >
                {entry.type === 'narration' ? (
                  <NarrationText text={entry.text} mentions={entry.mentions} />
                ) : entry.type === 'action-echo' ? (
                  <span style={{ fontStyle: 'italic' }}>
                    [{entry.authorName}] {entry.text}
                  </span>
                ) : entry.type === 'chat' ? (
                  <span>
                    <span style={{ fontWeight: 600 }}>{entry.authorName}</span>
                    {': "'}
                    {entry.text}
                    {'"'}
                  </span>
                ) : (
                  entry.text
                )}

                {/* Suggestion buttons — only on the last narration entry */}
                {isLastNarration && entry.suggestions && entry.suggestions.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.4rem',
                      marginTop: '0.6rem',
                    }}
                  >
                    {entry.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => submitInput(s)}
                        disabled={!connected}
                        style={{
                          background: 'none',
                          border: '1px solid var(--border)',
                          color: 'var(--text-muted)',
                          borderRadius: '4px',
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.8rem',
                          cursor: connected ? 'pointer' : 'default',
                          transition: 'border-color 0.15s, color 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          if (connected) {
                            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
                            (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Colour coding legend — subtle, shown once log has narration with mentions */}
        {log.some((e) => e.type === 'narration' && e.mentions && e.mentions.length > 0) && (
          <div
            style={{
              display: 'flex',
              gap: '1rem',
              marginBottom: '0.5rem',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <span><span style={{ color: MENTION_COLORS.npc }}>■</span> NPC</span>
            <span><span style={{ color: MENTION_COLORS.pc }}>■</span> Character</span>
            <span><span style={{ color: MENTION_COLORS.rishi }}>■</span> Rishi</span>
          </div>
        )}

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
            placeholder={connected ? 'What do you do? ("..." to speak to others)' : 'Connecting…'}
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

        {/* Disembody button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', flexShrink: 0 }}>
          <button
            onClick={handleDisembody}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              borderRadius: '4px',
              padding: '0.3rem 0.65rem',
              fontSize: '0.78rem',
              cursor: 'pointer',
              opacity: 0.65,
            }}
          >
            Disembody
          </button>
        </div>
      </div>

      {/* ── Right-side environment panel ──────────────────────────────── */}
      <div
        style={{
          width: '210px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          paddingTop: '0.1rem',
          borderLeft: '1px solid var(--border)',
          paddingLeft: '1rem',
          fontSize: '0.8rem',
          overflowY: 'auto',
        }}
      >
        {/* ── World › Zone breadcrumb + embodied character ── */}
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', lineHeight: 1.4 }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{worldName}</span>
            {zoneSlug && (
              <>
                <span style={{ opacity: 0.4 }}> › </span>
                <span>{zoneSlug}</span>
              </>
            )}
          </div>
          {characterName && (
            <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 500 }}>
              ◈ {characterName}
            </div>
          )}
        </div>

        {/* ── In this region: NPCs + players ── */}
        <div>
          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '0.5rem',
              opacity: 0.6,
            }}
          >
            In this region
          </div>

          {/* Known NPCs — disposition colour dot + clickable name + relationship bar */}
          {zoneNpcs.map((npc) => (
            <div
              key={npc.name}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}
            >
              <span
                style={{
                  color: DISPOSITION_COLORS[npc.disposition] ?? 'var(--text-muted)',
                  fontSize: '0.6rem',
                  flexShrink: 0,
                }}
              >
                ■
              </span>
              {/* NPC Quick-Interact: click to pre-fill input */}
              <button
                onClick={() => setInput(`speak to ${npc.name}`)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--warning)',
                  fontWeight: 500,
                  fontSize: '0.8rem',
                  textAlign: 'left',
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {npc.name}
              </button>
              {/* NPC Relationship Indicator */}
              {npc.relationshipScore !== undefined && (
                <span
                  title={`Relationship: ${npc.relationshipScore}`}
                  style={{
                    display: 'inline-block',
                    width: '24px',
                    height: '3px',
                    borderRadius: '2px',
                    flexShrink: 0,
                    background: npc.relationshipScore > 0
                      ? 'var(--success)'
                      : npc.relationshipScore < 0
                      ? 'var(--error)'
                      : 'var(--border)',
                    opacity: Math.min(1, 0.3 + Math.abs(npc.relationshipScore) / 100),
                  }}
                />
              )}
            </div>
          ))}

          {/* Active players */}
          {zonePlayers.map((p) => (
            <div
              key={p.playerId}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: 'var(--success)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.username}</span>
            </div>
          ))}

          {zoneNpcs.length === 0 && zonePlayers.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', opacity: 0.5 }}>
              Only you
            </div>
          )}
        </div>

        {/* ── Zone atmosphere ── */}
        {atmosphereTags.length > 0 && (
          <div>
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '0.5rem',
                opacity: 0.6,
              }}
            >
              Atmosphere
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {atmosphereTags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    color: 'var(--text-muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    padding: '0.15rem 0.4rem',
                    fontSize: '0.75rem',
                    display: 'inline-block',
                    opacity: 0.8,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Mini Zone Map ── */}
        {mapZones.length > 1 && (
          <div>
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '0.5rem',
                opacity: 0.6,
              }}
            >
              Zones
            </div>
            <svg
              width={160}
              height={120}
              style={{ display: 'block', overflow: 'visible' }}
            >
              {/* Edges */}
              {mapLayout.edges.map((e, i) => {
                const a = mapLayout.nodes.find(n => n.slug === e.from);
                const b = mapLayout.nodes.find(n => n.slug === e.to);
                if (!a || !b) return null;
                return (
                  <line
                    key={i}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="var(--border)"
                    strokeWidth={1}
                  />
                );
              })}
              {/* Nodes */}
              {mapLayout.nodes.map((n) => (
                <g
                  key={n.slug}
                  style={{ cursor: n.slug === zoneSlug ? 'default' : 'pointer' }}
                  onClick={() => {
                    if (n.slug !== zoneSlug) {
                      socketRef.current?.emit('player:move', {
                        sessionId: sessionId.current,
                        targetZoneSlug: n.slug,
                      });
                    }
                  }}
                >
                  <circle
                    cx={n.x} cy={n.y} r={6}
                    fill={n.slug === zoneSlug ? 'var(--accent)' : 'var(--bg)'}
                    stroke={n.slug === zoneSlug ? 'var(--accent)' : 'var(--border)'}
                    strokeWidth={1.5}
                  />
                  <text
                    x={n.x} y={n.y + 15}
                    textAnchor="middle"
                    style={{ fontSize: '0.52rem', fill: 'var(--text-muted)', pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {n.slug.length > 11 ? n.slug.slice(0, 10) + '…' : n.slug}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )}

        {/* ── Legend ── */}
        <div>
          <div
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '0.5rem',
              opacity: 0.6,
            }}
          >
            Legend
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: 'var(--text-muted)', opacity: 0.8 }}>
            <span><span style={{ color: MENTION_COLORS.npc }}>■</span> NPC</span>
            <span><span style={{ color: MENTION_COLORS.pc }}>■</span> Character</span>
            <span><span style={{ color: MENTION_COLORS.rishi }}>■</span> Rishi</span>
            <span style={{ marginTop: '0.25rem', fontSize: '0.72rem', opacity: 0.7, lineHeight: 1.4 }}>
              Start input with{' '}
              <span style={{ color: 'var(--success)', fontFamily: 'monospace' }}>"</span>
              {' '}to speak to others
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
