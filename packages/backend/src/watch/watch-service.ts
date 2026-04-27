import { prisma } from '../lib/prisma.js';

export async function getOrCreateWatchEntry(tmdbId: number, userId: number, watchedAt: Date) {
  return prisma.watchEntry.upsert({
    where: { tmdbId_userId: { tmdbId, userId } },
    update: { watchedAt },
    create: { tmdbId, userId, watchedAt },
  });
}

export async function deleteWatchEntry(tmdbId: number, userId: number) {
  await prisma.watchEntry.deleteMany({ where: { tmdbId, userId } });
}
