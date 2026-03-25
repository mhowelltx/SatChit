import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';

const prisma = new PrismaClient();

async function upsertLore(
  worldId: string,
  entries: Array<{ category: 'LAW' | 'CULTURE' | 'COSMOLOGY' | 'MYTH'; title: string; content: string }>,
) {
  for (const lore of entries) {
    const existing = await prisma.vedaLore.findFirst({ where: { worldId, title: lore.title } });
    if (!existing) {
      await prisma.vedaLore.create({ data: { worldId, ...lore } });
    }
    console.log(`  Lore: [${lore.category}] ${lore.title}`);
  }
}

async function main() {
  console.log('Seeding database...\n');

  // ── 1. Seed User ──────────────────────────────────────────────────────────
  const email = 'seed@satchit.dev';
  const passwordHash = await bcrypt.hash('satchit-seed', 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, username: 'satchit', passwordHash, role: 'CREATOR' },
    update: {},
  });
  console.log(`User: ${user.email} (id: ${user.id})`);

  // ── 2. The Verdant Accord (proto world) ───────────────────────────────────
  console.log('\n[The Verdant Accord]');
  const verdantSlug = slugify('The Verdant Accord', { lower: true, strict: true });
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? null;
  if (anthropicApiKey) {
    console.log('  Using ANTHROPIC_API_KEY from environment');
  } else {
    console.log('  No ANTHROPIC_API_KEY set — world will use stub AI');
  }

  const verdant = await prisma.world.upsert({
    where: { slug: verdantSlug },
    create: {
      creatorId: user.id,
      name: 'The Verdant Accord',
      slug: verdantSlug,
      description:
        'A world where the land itself tends to its children. The soil yields freely, the air heals, and the architecture grows rather than being built. Freed from survival, inhabitants turn their whole lives toward art, discovery, philosophy, and play — weaving a civilization defined not by what it conquers but by what it creates.',
      visibility: 'PUBLIC',
      foundationalLaws: [
        'The land provides — flora and water yield sustenance and shelter in abundance; no one need fear hunger, thirst, or cold',
        'Suffering dissipates — the atmosphere carries a gentle restorative quality; illness, grief, and despair slowly dissolve on the wind',
        'Creation begets creation — any work of art, craft, or invention subtly enriches the environment around it; beauty propagates beauty',
        'Memory resonates — profound emotions and discoveries ripple outward as a soft ambient feeling, building empathy between people without intrusion',
        'The land breathes — the world itself is alive in a slow, patient way; it responds to attention, care, and neglect over generations',
      ],
      culturalTypologies: [
        'The Weavers — artisans who grow living structures from cultivated organisms, believing the best shelter is one that breathes and grows with its inhabitants',
        'The Wandering Scholars — nomadic knowledge-keepers who map the ever-shifting landscape and chronicle discoveries in illuminated field codices',
        'The Dream Circles — communities that gather to explore the unconscious together, treating deep sleep as a shared creative canvas and source of revelation',
        'The Cultivators — stewards bonded to specific regions, entering into a wordless covenant with the land to tend, protect, and converse with it',
        'The Harmonists — musicians and composers who believe the world has a fundamental resonant note and dedicate their lives to hearing it and adding to it',
      ],
      anthropicApiKey,
    },
    update: { anthropicApiKey },
  });
  console.log(`World: ${verdant.name} (id: ${verdant.id})`);

  const verdantZones = [
    {
      name: 'The Meadow of Arrivals',
      slug: 'the-meadow-of-arrivals',
      description: 'A gently rolling meadow where all journeys in The Verdant Accord begin.',
      rawContent:
        'Warm light filters through a canopy of silver-leafed trees, dappling the grass below in shifting patterns of gold. The meadow breathes — you can feel it — a slow exhalation that carries the scent of rain and clover. Wildflowers lean toward you with a gentle curiosity. In the distance, a low melody drifts from somewhere unseen; it sounds like someone humming a song they only half remember, but it fills you with a contentment so complete it takes a moment to notice it is there. This is where you begin.',
    },
    {
      name: 'The Living Commons',
      slug: 'the-living-commons',
      description: 'A gathering space where Weavers, Scholars, and Harmonists meet to share work.',
      rawContent:
        'The Commons was not built — it grew. The great hall arches overhead in living timber, branches interlocked with such precision that no daylight is wasted and no shadow falls where it is not welcome. Tables of pressed earth hold unfinished projects: a half-woven tapestry that seems to continue itself overnight, stacked codices with marginalia in a dozen hands, instruments leaning against pillars as if set down mid-song. People move through the space at ease, stopping to examine, contribute, question. A Scholar is arguing cheerfully with a Harmonist about whether silence is a note. No one seems in a hurry. No one needs to be.',
    },
  ];

  for (const zoneData of verdantZones) {
    const zone = await prisma.vedaZone.upsert({
      where: { worldId_slug: { worldId: verdant.id, slug: zoneData.slug } },
      create: { worldId: verdant.id, ...zoneData },
      update: {},
    });
    console.log(`  Zone: ${zone.name}`);
  }

  await upsertLore(verdant.id, [
    {
      category: 'LAW',
      title: 'The First Yielding',
      content:
        'Long before memory, the land made a choice. It had the capacity to withhold — to test, to challenge, to demand. It chose otherwise. The First Yielding is not a historical event so much as an ongoing fact: every morning the land renews its decision to provide. The Cultivators say you can feel this decision in the soil if you press your ear to the ground just before dawn.',
    },
    {
      category: 'CULTURE',
      title: 'The Weavers and Their Homes',
      content:
        'A Weaver does not build a home. They cultivate one. Starting from a single seed-lattice, they tend the growth over years, coaxing walls from living fiber, ceilings from interlocked canopy, floors from root-felt that stays warm in all seasons. Each home is therefore unique — shaped by the patience and personality of its grower. To be invited into a Weaver\'s home is to be invited into a decades-long creative act.',
    },
    {
      category: 'CULTURE',
      title: 'The Dream Circles',
      content:
        'Each night, Dream Circles gather in open spaces and enter sleep together, their bodies arranged in a ring. What they share in the dreaming is not fully understood by outsiders — they emerge with shared memories of places none of them have visited, of conversations with figures no one can name. The discoveries made in dream have seeded some of the Accord\'s most celebrated art and philosophy. No one is required to join a Circle, but most do, eventually.',
    },
    {
      category: 'COSMOLOGY',
      title: 'The Resonant Note',
      content:
        "The Harmonists maintain that beneath all sound — beneath wind, voice, water, and stone — there is a single note that the world has been holding since its beginning. It is not a note you can play on any instrument, though many have tried. It is the note the world plays on itself, continuously. The Harmonists' life work is to hear it clearly enough to add to it: to contribute one true sound before they die.",
    },
  ]);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n--- Seed complete ---');
  console.log(`Proto world slug: ${verdant.slug}`);
  console.log(`Test login:  email=${email}  password=satchit-seed`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
