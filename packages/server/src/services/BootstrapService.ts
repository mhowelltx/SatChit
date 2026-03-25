import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * If RISHI_USERNAME and RISHI_PASSWORD are set in the environment, ensure that
 * user exists with ADMIN role and has an AvatarCharacter (Rishi) record.
 *
 * Safe to run on every startup — uses upsert so it never duplicates.
 * Password is only re-hashed and written when the account is first created.
 */
export async function bootstrapRishiAdmin(prisma: PrismaClient): Promise<void> {
  const username = process.env.RISHI_USERNAME?.trim();
  const password = process.env.RISHI_PASSWORD?.trim();

  if (!username || !password) return;

  const rishiName = process.env.RISHI_NAME?.trim() || username;
  const email = process.env.RISHI_EMAIL?.trim() || undefined;

  // Upsert the user — only hash the password on creation; never overwrite an
  // existing hash so that password changes via the app are not reverted.
  let user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    const passwordHash = await bcrypt.hash(password, 12);
    user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: 'ADMIN',
        ...(email ? { email } : {}),
      },
    });
    console.log(`[bootstrap] Rishi admin created: ${username}`);
  } else if (user.role !== 'ADMIN') {
    // Ensure existing account is promoted to ADMIN if it wasn't already
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    console.log(`[bootstrap] Rishi admin promoted to ADMIN: ${username}`);
  }

  // Upsert AvatarCharacter — presence of this record is what marks the user as Rishi
  const existing = await prisma.avatarCharacter.findUnique({ where: { userId: user.id } });
  if (!existing) {
    await prisma.avatarCharacter.create({
      data: {
        userId: user.id,
        name: rishiName,
        description: 'Cross-world avatar — the Rishi who walks between worlds.',
        traits: [],
      },
    });
    console.log(`[bootstrap] Rishi avatar created: "${rishiName}"`);
  }
}
