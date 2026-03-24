# SatChit

> *Sat* (existence/being) · *Chit* (consciousness/awareness)*

SatChit is a real-time multiplayer text-adventure game where players explore AI-generated worlds of their own making. World creators define the fundamental laws and cultural typologies of a universe; the AI fills in the details as players explore. Every discovery is stored in the world's **Veda** — an ever-growing body of lore that gives all future players a consistent experience.

---

## Core Concepts

### Worlds
A world is defined by its creator with a high-level sketch:
- **Foundational Laws** — the physical, metaphysical, or magical rules governing the universe
- **Cultural Typologies** — the kinds of societies, belief systems, and social structures present

The AI generates zones, entities, and events *on demand* as players explore — no pre-generation of the full universe.

### The Veda
The Veda is the accumulated knowledge of a world. It stores:
- **Zones** — locations players have discovered, with AI-generated descriptions
- **Entities** — NPCs, creatures, factions, and objects encountered
- **Events** — notable things that happened in the world
- **Lore** — the fundamental laws, myths, cultures, and cosmology

When a player visits a zone already in the Veda, they see exactly what prior explorers found — no AI call needed. New zones are generated and written to the Veda immediately.

### Real-time Multiplayer
Multiple players can explore the same world simultaneously. Players in the same zone share a Socket.io room and see each other's actions and the AI's narrations in real time.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Next.js 15 (App Router, TypeScript) |
| Backend | Node.js + Express + Socket.io (TypeScript) |
| Shared types | `packages/shared` |
| Database | PostgreSQL via Prisma ORM |
| AI | Pluggable adapter (`IAIProvider`) |
| Real-time | Socket.io, rooms per zone |

---

## Project Structure

```
/
├── packages/
│   ├── web/          # Next.js frontend
│   ├── server/       # Express + Socket.io API
│   └── shared/       # TypeScript types & interfaces
├── prisma/
│   └── schema.prisma
├── package.json      # pnpm workspaces root
├── turbo.json
└── tsconfig.base.json
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and AI provider settings

# Apply database schema
pnpm db:push

# Start all services in development
pnpm dev
```

The web app will be available at `http://localhost:3000` and the API server at `http://localhost:3001`.

---

## AI Providers

SatChit uses a pluggable AI adapter. Set `AI_PROVIDER` in your `.env`:

| Value | Provider |
|---|---|
| `anthropic` | Claude (Anthropic) |
| `openai` | OpenAI (GPT-4) |
| `stub` | Stub/mock (for development) |

---

## Environment Variables

See `.env.example` for all required and optional variables.

---

## License

MIT
