import type { PrismaClient } from '@prisma/client';
import type { GameSession } from '@satchit/shared';

export class SessionService {
  constructor(private prisma: PrismaClient) {}

  async create(worldId: string, playerId: string): Promise<GameSession> {
    // End any existing active sessions for this player in this world
    await this.prisma.gameSession.updateMany({
      where: { worldId, playerId, status: 'ACTIVE' },
      data: { status: 'ENDED' },
    });

    const session = await this.prisma.gameSession.create({
      data: { worldId, playerId },
    });
    return session as GameSession;
  }

  async findById(sessionId: string): Promise<GameSession | null> {
    const session = await this.prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
    return session as GameSession | null;
  }

  async updateZone(sessionId: string, zoneId: string): Promise<GameSession> {
    const session = await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: { currentZoneId: zoneId },
    });
    return session as GameSession;
  }

  async end(sessionId: string): Promise<void> {
    await this.prisma.gameSession.update({
      where: { id: sessionId },
      data: { status: 'ENDED' },
    });
  }

  async recordAction(
    sessionId: string,
    rawInput: string,
    aiResponse: string,
  ): Promise<void> {
    await this.prisma.playerAction.create({
      data: { sessionId, rawInput, aiResponse },
    });
  }
}
