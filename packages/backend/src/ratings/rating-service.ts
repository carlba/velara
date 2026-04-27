import { prisma } from '../lib/prisma.js';

export async function upsertRating(tmdbId: number, userId: number, score: number) {
  return prisma.rating.upsert({
    where: { tmdbId_userId: { tmdbId, userId } },
    update: { score },
    create: { tmdbId, userId, score },
  });
}

export async function deleteRating(tmdbId: number, userId: number) {
  await prisma.rating.deleteMany({ where: { tmdbId, userId } });
}
