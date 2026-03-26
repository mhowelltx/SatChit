import slugify from 'slugify';
import type { PrismaClient } from '@prisma/client';
import type { World, VedaZone, Character, WorldFeature } from '@satchit/shared';
import type { IAIProvider } from '../ai/index.js';
import { AnthropicProvider } from '../ai/providers/anthropic.js';
import { VedaService } from './VedaService.js';
import { NPCService } from './NPCService.js';
import { WorldFeatureService } from './WorldFeatureService.js';

interface BootstrapResult {
  starterZones: VedaZone[];
  originSummary: string;
}

interface ActionResult {
  narration: string;
  zone: VedaZone;
  /** Destination zone if the narration describes the player arriving somewhere new */
  nextZone?: VedaZone;
  isNewZone: boolean;
  /** Whether nextZone was newly created during this action */
  isNewNextZone?: boolean;
  suggestions?: string[];
  /** Names of NPCs present in the zone during this action */
  npcsPresent?: string[];
  /** Active player character name, if any */
  characterName?: string;
  /** AI-assigned mood extracted from this narration */
  nextMood?: string;
  /** A player-built feature detected in this narration */
  newFeature?: WorldFeature;
}

export class WorldGeneratorService {
  private vedaService: VedaService;
  private npcService: NPCService;
  private worldFeatureService: WorldFeatureService;

  constructor(
    private prisma: PrismaClient,
    private ai: IAIProvider,
  ) {
    this.vedaService = new VedaService(prisma);
    this.npcService = new NPCService(prisma);
    this.worldFeatureService = new WorldFeatureService(prisma);
  }

  private providerFor(world: World): IAIProvider {
    if (world.anthropicApiKey) {
      return new AnthropicProvider(world.anthropicApiKey);
    }
    return this.ai;
  }

  /**
   * Bootstrap a newly created world: generate an origin summary and
   * 1–3 starter zones to give players somewhere to begin.
   */
  async bootstrapWorld(world: World): Promise<BootstrapResult> {
    const worldLore = await this.vedaService.listLore(world.id);

    const context = {
      world: {
        name: world.name,
        foundationalLaws: world.foundationalLaws,
        culturalTypologies: world.culturalTypologies,
      },
      worldLore,
    };

    const ai = this.providerFor(world);

    // Generate origin summary
    const originSummary = await ai.generate(
      `Write a vivid, 2-paragraph origin summary for the world of "${world.name}".
       This will be the first thing players see when they discover this world.
       Hint at mysteries, cultures, and the laws that shape existence here.`,
      context,
    );

    // Generate starter zone details (including atmosphere tags)
    const starterZoneShape = {
      zones: [
        {
          name: 'Zone Name',
          description: 'A short description of what this zone looks, sounds, and feels like.',
          rawContent: 'Detailed 1-2 paragraph AI narration a player would see upon entering.',
          atmosphereTags: ['mood-tag-1', 'mood-tag-2'],
        },
      ],
    };

    const generated = await ai.generateStructured(
      `Create exactly 2 starting zones for the world of "${world.name}".
       These should feel distinct from each other and organically reflect the world's laws and cultures.
       Include 2-3 short atmosphere tags per zone (e.g. "fog-shrouded", "ancient", "bustling", "eerie").`,
      context,
      starterZoneShape,
    );

    const zoneDefs = generated?.zones ?? [
      {
        name: 'The Beginning',
        description: 'Where all journeys start.',
        rawContent: `You stand at the threshold of ${world.name}. The air itself seems to carry the weight of ancient laws. Your journey begins here.`,
        atmosphereTags: ['ancient', 'liminal'],
      },
    ];

    const starterZones: VedaZone[] = [];
    for (const def of zoneDefs) {
      // @ts-ignore: slugify CJS/ESM interop issue with NodeNext
      const slug = slugify(def.name, { lower: true, strict: true });
      const zone = await this.vedaService.saveZone({
        worldId: world.id,
        name: def.name,
        slug,
        description: def.description,
        rawContent: def.rawContent,
        atmosphereTags: Array.isArray(def.atmosphereTags) ? def.atmosphereTags : [],
      });
      starterZones.push(zone);
    }

    return { starterZones, originSummary };
  }

  /**
   * Process a player action in a given zone.
   * Includes all enhanced context: environmental fading, tension, mood, relationships,
   * world features, and automatic zone transition detection.
   */
  async processAction(
    world: World,
    currentZoneSlug: string,
    playerInput: string,
    playerId: string,
    character?: Character | null,
    zoneMessageCount = 0,
    sessionActionCount = 0,
    currentMood?: string,
  ): Promise<ActionResult> {
    // Check Veda cache
    let zone = await this.vedaService.getZone(world.id, currentZoneSlug);
    const isNewZone = !zone;

    const worldLore = await this.vedaService.listLore(world.id);
    const nearbyZones = await this.vedaService.listZones(world.id);
    const npcsInZone = zone ? await this.npcService.listByZone(zone.id) : [];
    const featuresInZone = zone ? await this.worldFeatureService.findByZone(zone.id) : [];

    const ai = this.providerFor(world);

    const characterContext = character
      ? {
          name: character.name,
          species: character.species,
          race: character.race,
          gender: character.gender,
          traits: character.traits,
          skills: character.skills,
          abilities: character.abilities,
          physicalDescription: character.physicalDescription,
        }
      : null;

    // Zone re-entry memory: fetch past events for this player in this zone
    let zoneHistory: string[] = [];
    if (zone && !isNewZone) {
      const pastEvents = await this.vedaService.listZoneEventsForPlayer(
        world.id,
        zone.name,
        playerId,
        3,
      );
      zoneHistory = pastEvents.map((e) => e.description);
    }

    // NPC relationship scores for NPCs in this zone
    const npcRelationships: Record<string, number> = {};
    for (const npc of npcsInZone) {
      const rel = await this.npcService.getRelationship(npc.id, playerId);
      if (rel) {
        npcRelationships[npc.name] = rel.score;
      }
    }

    const context = {
      world: {
        name: world.name,
        foundationalLaws: world.foundationalLaws,
        culturalTypologies: world.culturalTypologies,
      },
      character: characterContext,
      currentZone: zone ?? undefined,
      nearbyZones,
      worldLore,
      npcsPresent: npcsInZone.map((n) => ({
        name: n.name,
        disposition: n.disposition,
        traits: n.traits,
        physicalDescription: n.physicalDescription,
      })),
      featuresPresent: featuresInZone.map((f) => ({
        name: f.name,
        featureType: f.featureType,
        description: f.description,
      })),
      playerInput,
      zoneMessageCount,
      sessionActionCount,
      currentMood,
      zoneHistory,
      npcRelationships,
      atmosphereTags: zone?.atmosphereTags,
    };

    if (isNewZone) {
      // Generate and persist new zone
      const slug = currentZoneSlug;
      const zoneName = slug
        .split('-')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      const rawContent = await ai.generate(
        `The player has arrived in "${zoneName}" for the first time.
         Describe this location in vivid detail — what they see, hear, feel, and sense.
         Make it feel like a natural part of ${world.name}.${characterContext ? `\nThe player's character is ${characterContext.name}, a ${characterContext.species ?? 'being'} — let the description acknowledge their perspective if appropriate.` : ''}`,
        context,
      );

      // Generate atmosphere tags for the new zone
      const tagsResult = await ai.generateStructured(
        `Based on this zone description, assign 2-4 short atmosphere tags (e.g. "fog-shrouded", "ancient", "tense", "serene", "bustling", "desolate"):
         "${rawContent}"`,
        { world: context.world },
        { tags: ['tag'] },
      ).catch(() => null);
      const atmosphereTags = tagsResult?.tags?.slice(0, 4) ?? [];

      zone = await this.vedaService.saveZone({
        worldId: world.id,
        name: zoneName,
        slug,
        description: rawContent.split('\n')[0] ?? rawContent.slice(0, 150),
        rawContent,
        atmosphereTags,
        discoveredById: playerId,
      });
    }

    // Generate narration for the player's specific action
    const characterLine = characterContext
      ? `The player's character is ${characterContext.name}${characterContext.species ? `, a ${characterContext.species}` : ''}${characterContext.traits.length ? ` with traits: ${characterContext.traits.join(', ')}` : ''}.`
      : '';

    const narration = await ai.generate(
      `The player is in "${zone!.name}" and does the following: "${playerInput}".
       ${characterLine}
       Narrate what happens, staying true to the world's laws and the zone's established details.
       If the player interacts with an NPC, reflect that NPC's disposition and personality.
       If the player interacts with a known feature (${featuresInZone.map(f => f.name).join(', ') || 'none'}), acknowledge it naturally.`,
      { ...context, currentZone: zone, atmosphereTags: zone!.atmosphereTags },
    );

    // Best-effort: generate 3-4 suggested follow-up actions
    let suggestions: string[] | undefined;
    try {
      const suggestionsResult = await ai.generateStructured(
        `Given this narration in "${zone!.name}":
         "${narration}"
         Suggest exactly 3 short player action phrases (5-10 words each) that would be natural next moves.
         Phrase them as player actions (e.g. "Examine the glowing inscription", "Ask the elder about the ruins").`,
        { world: context.world },
        { suggestions: ['action phrase'] },
      );
      suggestions = suggestionsResult?.suggestions?.slice(0, 4);
    } catch {
      // Suggestions are best-effort
    }

    // Best-effort: extract the ambient mood from this narration for persistence
    let nextMood: string | undefined;
    try {
      const moodResult = await ai.generateStructured(
        `In one to three words, what is the dominant mood or atmosphere of this narration?
         Examples: "tense", "melancholy wonder", "creeping dread", "quiet joy".
         Narration: "${narration}"`,
        { world: context.world },
        { mood: 'mood phrase' },
      );
      if (moodResult?.mood && typeof moodResult.mood === 'string') {
        nextMood = moodResult.mood;
      }
    } catch {
      // Mood extraction is best-effort
    }

    // Attempt to extract and persist any new NPCs mentioned in the narration
    await this.extractAndPersistNPCs(world, zone!, narration, ai);

    // Attempt to detect and persist any player-built world features
    const newFeature = await this.extractAndPersistFeatures(
      world,
      zone!,
      narration,
      playerId,
      characterContext?.name ?? null,
      activeCharacterId(character),
      ai,
    );

    // Best-effort: update NPC relationships based on interaction
    await this.updateNPCRelationships(world, zone!, npcsInZone, narration, playerId, ai);

    // Best-effort: log interactions with existing features
    await this.recordFeatureInteractions(zone!, featuresInZone, narration, playerId, activeCharacterId(character));

    // Record the event in the Veda
    await this.vedaService.saveEvent({
      worldId: world.id,
      description: `${character?.name ?? `Player ${playerId}`} in ${zone!.name}: "${playerInput}"`,
      participantIds: [playerId],
    });

    // Best-effort: detect zone transition from narration
    let nextZone: VedaZone | undefined;
    let isNewNextZone = false;
    try {
      const transitionResult = await ai.generateStructured(
        `Does this narration clearly describe the character ARRIVING at or ENTERING a distinctly new named location — not just moving within the current area?
         Current zone: "${zone!.name}"
         If yes, provide the destination location name (2-5 words) as newZoneName.
         If no transition occurred, leave newZoneName as an empty string.
         Narration: "${narration}"`,
        { world: context.world },
        { newZoneName: '' },
      );
      const candidateName = transitionResult?.newZoneName;
      if (candidateName && typeof candidateName === 'string' && candidateName.trim() !== '') {
        // @ts-ignore: slugify CJS/ESM interop issue with NodeNext
        const candidateSlug = slugify(candidateName, { lower: true, strict: true });
        if (candidateSlug && candidateSlug !== zone!.slug) {
          const existing = await this.vedaService.getZone(world.id, candidateSlug);
          if (existing) {
            nextZone = existing;
          } else {
            // Generate the new zone
            const rawContent = await ai.generate(
              `The player has arrived in "${candidateName}" for the first time.
               Describe this location in vivid detail — what they see, hear, feel, and sense.
               Make it feel like a natural part of ${world.name}.${characterContext ? `\nThe player's character is ${characterContext.name}, a ${characterContext.species ?? 'being'}.` : ''}`,
              context,
            );
            const tagsResult = await ai.generateStructured(
              `Assign 2-4 short atmosphere tags for: "${rawContent}"`,
              { world: context.world },
              { tags: ['tag'] },
            ).catch(() => null);
            nextZone = await this.vedaService.saveZone({
              worldId: world.id,
              name: candidateName,
              slug: candidateSlug,
              description: rawContent.split('\n')[0] ?? rawContent.slice(0, 150),
              rawContent,
              atmosphereTags: tagsResult?.tags?.slice(0, 4) ?? [],
              discoveredById: playerId,
            });
            isNewNextZone = true;
          }
        }
      }
    } catch {
      // Zone transition detection is best-effort
    }

    return {
      narration,
      zone: zone!,
      nextZone,
      isNewZone,
      isNewNextZone,
      suggestions,
      npcsPresent: npcsInZone.map((n) => n.name),
      characterName: characterContext?.name,
      nextMood,
      ...(newFeature ? { newFeature } : {}),
    };
  }

  /**
   * Ask the AI to extract any NPCs from the narration and persist them.
   */
  private async extractAndPersistNPCs(
    world: World,
    zone: VedaZone,
    narration: string,
    ai: IAIProvider,
  ): Promise<void> {
    try {
      const npcShape = {
        npcs: [
          {
            name: 'NPC name',
            species: 'species or null',
            race: 'race or null',
            gender: 'gender or null',
            physicalDescription: 'brief physical description',
            traits: ['personality trait'],
            disposition: 'friendly | neutral | wary | hostile',
            backstory: 'one sentence backstory or null',
          },
        ],
      };

      const extracted = await ai.generateStructured(
        `Read this narration and extract any named NPCs (people, creatures with names, significant beings) who appear.
         Only include NPCs that are clearly present and interacted with. Return an empty array if none.
         Narration: "${narration}"`,
        { world: { name: world.name, foundationalLaws: world.foundationalLaws ?? [], culturalTypologies: world.culturalTypologies ?? [] } },
        npcShape,
      );

      const npcs: any[] = extracted?.npcs ?? [];

      for (const npcData of npcs) {
        if (!npcData.name) continue;

        const existing = await this.npcService.findByName(world.id, npcData.name);
        if (existing) {
          await this.npcService.updateZone(existing.id, zone.id);
          continue;
        }

        const vedaEntity = await this.vedaService.saveEntity({
          worldId: world.id,
          zoneId: zone.id,
          name: npcData.name,
          entityType: 'NPC',
          description: npcData.physicalDescription ?? npcData.name,
        });

        await this.npcService.create({
          worldId: world.id,
          vedaEntityId: vedaEntity.id,
          currentZoneId: zone.id,
          name: npcData.name,
          species: npcData.species !== 'null' ? npcData.species : undefined,
          race: npcData.race !== 'null' ? npcData.race : undefined,
          gender: npcData.gender !== 'null' ? npcData.gender : undefined,
          physicalDescription: npcData.physicalDescription,
          traits: Array.isArray(npcData.traits) ? npcData.traits : [],
          disposition: npcData.disposition ?? 'neutral',
          backstory: npcData.backstory !== 'null' ? npcData.backstory : undefined,
        });
      }
    } catch {
      // NPC extraction is best-effort
    }
  }

  /**
   * Ask the AI if the player built or created a permanent world feature.
   * If detected and not already recorded, persist it and return it.
   */
  private async extractAndPersistFeatures(
    world: World,
    zone: VedaZone,
    narration: string,
    playerId: string,
    characterName: string | null,
    characterId: string | null,
    ai: IAIProvider,
  ): Promise<WorldFeature | null> {
    try {
      const featureShape = {
        featureCreated: false,
        name: 'name of the feature',
        featureType: 'MONUMENT',
        description: 'brief description of the feature',
      };

      const extracted = await ai.generateStructured(
        `Did the player BUILD, CONSTRUCT, ERECT, CARVE, or CREATE a permanent physical feature in this narration?
         Only set featureCreated to true if the player's action directly resulted in creating something new and tangible that would persist in the world (e.g. a monument, altar, cairn, building, marker, shrine, structure, throne).
         Do NOT include pre-existing things the player merely discovered or interacted with.
         If yes, set featureCreated: true and fill in name, featureType, and description.
         If no, set featureCreated: false.
         Valid featureType values: MONUMENT, BUILDING, ALTAR, STRUCTURE, MARKER, OTHER
         Narration: "${narration}"`,
        { world: { name: world.name, foundationalLaws: world.foundationalLaws ?? [], culturalTypologies: world.culturalTypologies ?? [] } },
        featureShape,
      );

      if (!extracted?.featureCreated || !extracted.name) return null;
      const featureData = extracted;

      // Avoid duplicates
      const existing = await this.worldFeatureService.findByName(world.id, featureData.name);
      if (existing) return null;

      const feature = await this.worldFeatureService.create({
        worldId: world.id,
        zoneId: zone.id,
        name: featureData.name,
        description: featureData.description ?? featureData.name,
        featureType: featureData.featureType ?? 'OTHER',
        builtByPlayerId: playerId,
        builtByCharacterId: characterId ?? undefined,
      });

      return feature;
    } catch {
      // Feature extraction is best-effort
      return null;
    }
  }

  /**
   * Log interactions with known features in the zone if the narration mentions them.
   */
  private async recordFeatureInteractions(
    zone: VedaZone,
    featuresInZone: WorldFeature[],
    narration: string,
    playerId: string,
    characterId: string | null,
  ): Promise<void> {
    if (featuresInZone.length === 0) return;
    try {
      for (const feature of featuresInZone) {
        // Simple check: feature name mentioned in narration
        if (narration.toLowerCase().includes(feature.name.toLowerCase())) {
          await this.worldFeatureService.addInteraction(
            feature.id,
            playerId,
            characterId,
            `Interacted in ${zone.name}`,
          );
        }
      }
    } catch {
      // best-effort
    }
  }

  /**
   * Infer relationship changes from the narration and persist them.
   * Uses a lightweight structured call to score the interaction.
   */
  private async updateNPCRelationships(
    world: World,
    zone: VedaZone,
    npcsInZone: Awaited<ReturnType<NPCService['listByZone']>>,
    narration: string,
    playerId: string,
    ai: IAIProvider,
  ): Promise<void> {
    if (npcsInZone.length === 0) return;
    try {
      const npcNames = npcsInZone.map((n) => n.name);
      const relShape = {
        interactions: [
          { npcName: 'NPC name', delta: 0, note: 'one-sentence context' },
        ],
      };

      const result = await ai.generateStructured(
        `Based on this narration, did the player's interaction change their relationship with any of these NPCs: ${npcNames.join(', ')}?
         For each NPC actually interacted with, provide a delta (-10 to +10) and a one-sentence note.
         Only include NPCs with meaningful interactions. Return an empty array if none.
         Narration: "${narration}"`,
        { world: { name: world.name, foundationalLaws: world.foundationalLaws ?? [], culturalTypologies: world.culturalTypologies ?? [] } },
        relShape,
      );

      for (const interaction of result?.interactions ?? []) {
        if (!interaction.npcName || typeof interaction.delta !== 'number') continue;
        const npc = npcsInZone.find((n) => n.name === interaction.npcName);
        if (!npc) continue;
        await this.npcService.adjustRelationship(
          world.id,
          npc.id,
          playerId,
          interaction.delta,
          interaction.note,
        );
      }
    } catch {
      // Relationship updates are best-effort
    }
  }
}

/** Extract character id from a Character object */
function activeCharacterId(character?: Character | null): string | null {
  return character?.id ?? null;
}
