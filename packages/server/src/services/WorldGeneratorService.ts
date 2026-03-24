import slugify from 'slugify';
import type { PrismaClient } from '@prisma/client';
import type { World, VedaZone } from '@satchit/shared';
import type { IAIProvider } from '../ai/index.js';
import { AnthropicProvider } from '../ai/providers/anthropic.js';
import { VedaService } from './VedaService.js';

interface BootstrapResult {
  starterZones: VedaZone[];
  originSummary: string;
}

interface ActionResult {
  narration: string;
  zone: VedaZone;
  isNewZone: boolean;
}

export class WorldGeneratorService {
  private vedaService: VedaService;

  constructor(
    private prisma: PrismaClient,
    private ai: IAIProvider,
  ) {
    this.vedaService = new VedaService(prisma);
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

    // Generate starter zone details
    const starterZoneShape = {
      zones: [
        {
          name: 'Zone Name',
          description: 'A short description of what this zone looks, sounds, and feels like.',
          rawContent: 'Detailed 2-paragraph AI narration a player would see upon entering.',
        },
      ],
    };

    const generated = await ai.generateStructured(
      `Create exactly 2 starting zones for the world of "${world.name}".
       These should feel distinct from each other and organically reflect the world's laws and cultures.`,
      context,
      starterZoneShape,
    );

    const zoneDefs = generated?.zones ?? [
      {
        name: 'The Beginning',
        description: 'Where all journeys start.',
        rawContent: `You stand at the threshold of ${world.name}. The air itself seems to carry the weight of ancient laws. Your journey begins here.`,
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
      });
      starterZones.push(zone);
    }

    return { starterZones, originSummary };
  }

  /**
   * Process a player action in a given zone.
   * Checks the Veda first — if the zone is already known, no AI call is needed.
   * If the player is exploring somewhere new, generates and persists it.
   */
  async processAction(
    world: World,
    currentZoneSlug: string,
    playerInput: string,
    playerId: string,
  ): Promise<ActionResult> {
    // Check Veda cache
    let zone = await this.vedaService.getZone(world.id, currentZoneSlug);
    const isNewZone = !zone;

    const worldLore = await this.vedaService.listLore(world.id);
    const nearbyZones = await this.vedaService.listZones(world.id);

    const ai = this.providerFor(world);

    const context = {
      world: {
        name: world.name,
        foundationalLaws: world.foundationalLaws,
        culturalTypologies: world.culturalTypologies,
      },
      currentZone: zone ?? undefined,
      nearbyZones,
      worldLore,
      playerInput,
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
         Make it feel like a natural part of ${world.name}.`,
        context,
      );

      zone = await this.vedaService.saveZone({
        worldId: world.id,
        name: zoneName,
        slug,
        description: rawContent.split('\n')[0] ?? rawContent.slice(0, 150),
        rawContent,
        discoveredById: playerId,
      });
    }

    // Generate narration for the player's specific action in this zone
    const narration = await ai.generate(
      `The player is in "${zone!.name}" and does the following: "${playerInput}".
       Narrate what happens, staying true to the world's laws and the zone's established details.`,
      { ...context, currentZone: zone },
    );

    // Record the event in the Veda
    await this.vedaService.saveEvent({
      worldId: world.id,
      description: `Player ${playerId} in ${zone!.name}: "${playerInput}"`,
      participantIds: [playerId],
    });

    return { narration, zone: zone!, isNewZone };
  }
}
