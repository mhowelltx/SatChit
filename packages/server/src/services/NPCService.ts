import type { PrismaClient } from '@prisma/client';
import type { NPC, NPCRelationship } from '@satchit/shared';

export interface CreateNPCData {
  worldId: string;
  vedaEntityId?: string;
  currentZoneId?: string;
  name: string;
  species?: string;
  race?: string;
  gender?: string;
  age?: number;
  physicalDescription?: string;
  traits?: string[];
  skills?: Record<string, number>;
  abilities?: string[];
  backstory?: string;
  disposition?: string;
  stats?: Record<string, unknown>;
}

export class NPCService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateNPCData): Promise<NPC> {
    const npc = await this.prisma.nPC.create({
      data: {
        worldId: data.worldId,
        vedaEntityId: data.vedaEntityId ?? null,
        currentZoneId: data.currentZoneId ?? null,
        name: data.name,
        species: data.species ?? null,
        race: data.race ?? null,
        gender: data.gender ?? null,
        age: data.age ?? null,
        physicalDescription: data.physicalDescription ?? null,
        traits: data.traits ?? [],
        skills: (data.skills ?? {}) as object,
        abilities: data.abilities ?? [],
        backstory: data.backstory ?? null,
        disposition: data.disposition ?? 'neutral',
        stats: (data.stats ?? {}) as object,
      },
    });
    return npc as unknown as NPC;
  }

  async findByVedaEntity(vedaEntityId: string): Promise<NPC | null> {
    const npc = await this.prisma.nPC.findUnique({ where: { vedaEntityId } });
    return npc as unknown as NPC | null;
  }

  async findByName(worldId: string, name: string): Promise<NPC | null> {
    const npc = await this.prisma.nPC.findFirst({ where: { worldId, name } });
    return npc as unknown as NPC | null;
  }

  async listByWorld(worldId: string): Promise<NPC[]> {
    const npcs = await this.prisma.nPC.findMany({
      where: { worldId },
      orderBy: { createdAt: 'asc' },
    });
    return npcs as unknown as NPC[];
  }

  async listByZone(zoneId: string): Promise<NPC[]> {
    const npcs = await this.prisma.nPC.findMany({
      where: { currentZoneId: zoneId },
      orderBy: { name: 'asc' },
    });
    return npcs as unknown as NPC[];
  }

  async updateZone(npcId: string, zoneId: string): Promise<void> {
    await this.prisma.nPC.update({
      where: { id: npcId },
      data: { currentZoneId: zoneId },
    });
  }

  // ── Relationships ──────────────────────────────────────────────────────────

  async getRelationship(npcId: string, playerId: string): Promise<NPCRelationship | null> {
    const rel = await this.prisma.nPCRelationship.findUnique({
      where: { npcId_playerId: { npcId, playerId } },
    });
    return rel as unknown as NPCRelationship | null;
  }

  async listRelationshipsForPlayer(worldId: string, playerId: string): Promise<NPCRelationship[]> {
    const rels = await this.prisma.nPCRelationship.findMany({
      where: { worldId, playerId },
    });
    return rels as unknown as NPCRelationship[];
  }

  /**
   * Adjust a player's relationship score with an NPC.
   * delta: positive = friendlier, negative = more hostile. Clamped to [-100, 100].
   * note: optional short context note for this interaction.
   */
  async adjustRelationship(
    worldId: string,
    npcId: string,
    playerId: string,
    delta: number,
    note?: string,
  ): Promise<NPCRelationship> {
    const existing = await this.getRelationship(npcId, playerId);
    const currentScore = existing?.score ?? 0;
    const newScore = Math.max(-100, Math.min(100, currentScore + delta));
    const currentNotes = existing?.notes ?? [];
    const updatedNotes = note
      ? [...currentNotes.slice(-4), note] // keep last 5 notes
      : currentNotes;

    const rel = await this.prisma.nPCRelationship.upsert({
      where: { npcId_playerId: { npcId, playerId } },
      create: { worldId, npcId, playerId, score: newScore, notes: updatedNotes },
      update: { score: newScore, notes: updatedNotes, lastInteraction: new Date() },
    });
    return rel as unknown as NPCRelationship;
  }

  async update(npcId: string, data: Partial<CreateNPCData>): Promise<NPC> {
    const npc = await this.prisma.nPC.update({
      where: { id: npcId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.species !== undefined && { species: data.species }),
        ...(data.race !== undefined && { race: data.race }),
        ...(data.gender !== undefined && { gender: data.gender }),
        ...(data.age !== undefined && { age: data.age }),
        ...(data.physicalDescription !== undefined && { physicalDescription: data.physicalDescription }),
        ...(data.traits !== undefined && { traits: data.traits }),
        ...(data.skills !== undefined && { skills: data.skills as object }),
        ...(data.abilities !== undefined && { abilities: data.abilities }),
        ...(data.backstory !== undefined && { backstory: data.backstory }),
        ...(data.disposition !== undefined && { disposition: data.disposition }),
        ...(data.stats !== undefined && { stats: data.stats as object }),
      },
    });
    return npc as unknown as NPC;
  }
}
