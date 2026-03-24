import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import slugify from 'slugify';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...\n');

  // ── 1. Test User ──────────────────────────────────────────────────────────
  const email = 'test@satchit.dev';
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      username: 'testseed',
      passwordHash,
      role: 'CREATOR',
    },
    update: {},
  });
  console.log(`User: ${user.email} (id: ${user.id})`);

  // ── 2. Sample World ───────────────────────────────────────────────────────
  const worldName = 'The Ember Lattice';
  const slug = slugify(worldName, { lower: true, strict: true });

  const world = await prisma.world.upsert({
    where: { slug },
    create: {
      creatorId: user.id,
      name: worldName,
      slug,
      description: 'A world where memory is currency and fire is law.',
      visibility: 'PUBLIC',
      foundationalLaws: [
        'Fire consumes what is false',
        'Memory cannot be destroyed, only transferred',
        'The Lattice connects all living minds',
      ],
      culturalTypologies: [
        'The Ember Keepers — priests of living flame',
        'The Weavers — collectors of traded memories',
        'The Ashen — those who have lost their memories entirely',
      ],
    },
    update: {},
  });
  console.log(`World: ${world.name} (slug: ${world.slug}, id: ${world.id})`);

  // ── 3. Starter Zones ─────────────────────────────────────────────────────
  const zones = [
    {
      name: 'The Ember Gate',
      slug: 'the-ember-gate',
      description: 'The entrance to The Ember Lattice. Flames dance in geometric patterns.',
      rawContent:
        'You stand before the Ember Gate. Geometric flames spiral upward, each pattern unique to a soul that has passed through. The air smells of cedar and ozone. Two Ember Keepers stand watch, their robes woven from solidified smoke.',
    },
    {
      name: 'The Memory Market',
      slug: 'the-memory-market',
      description: 'A bazaar where memories are bartered like coin.',
      rawContent:
        "Stalls crowd the square, each draped in iridescent cloth that shifts color as you approach. Merchants hold out small glass spheres — each containing a glowing scene. A child's laugh. A battlefield at dawn. The taste of a fruit that no longer grows. Weavers move through the crowd, appraising, negotiating, absorbing.",
    },
  ];

  for (const zoneData of zones) {
    const zone = await prisma.vedaZone.upsert({
      where: { worldId_slug: { worldId: world.id, slug: zoneData.slug } },
      create: { worldId: world.id, ...zoneData },
      update: {},
    });
    console.log(`  Zone: ${zone.name} (slug: ${zone.slug})`);
  }

  // ── 4. Lore Entries ───────────────────────────────────────────────────────
  const loreEntries = [
    {
      category: 'LAW' as const,
      title: 'The First Burning',
      content:
        'In the beginning, the Lattice was dark and silent. The First Flame was lit not by gods but by a mortal who burned their own memories to illuminate the world for others. This act established the law: fire consumes what is false.',
    },
    {
      category: 'CULTURE' as const,
      title: 'The Ember Keepers',
      content:
        "The Ember Keepers maintain the Gate-Flames that separate the Lattice's districts. They are selected at birth by the flame — those who do not flinch when their hand passes through fire. They neither buy nor sell memories; they only witness.",
    },
  ];

  for (const lore of loreEntries) {
    await prisma.vedaLore.create({
      data: { worldId: world.id, ...lore },
    });
    console.log(`  Lore: [${lore.category}] ${lore.title}`);
  }

  // ── 5. Summary ────────────────────────────────────────────────────────────
  console.log('\n--- Seed complete ---');
  console.log(`World slug for testing: ${world.slug}`);
  console.log(`World ID for socket testing: ${world.id}`);
  console.log(`Player ID for socket testing: ${user.id}`);
  console.log('\nManual test commands:');
  console.log(
    `  curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@satchit.dev","password":"password123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])"`,
  );
  console.log(
    `  curl -s http://localhost:3001/api/worlds/${world.slug} | python3 -c "import sys,json; print(json.load(sys.stdin)['world']['id'])"`,
  );
  console.log(
    `  curl -s http://localhost:3001/api/worlds/${world.id}/veda | python3 -c "import sys,json; print(len(json.load(sys.stdin)['zones']), 'zones')"`,
  );
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
