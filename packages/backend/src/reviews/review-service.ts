import { prisma } from '../lib/prisma.js';

export async function upsertReview(tmdbId: number, userId: number, content: string) {
  return prisma.review.upsert({
    where: { tmdbId_userId: { tmdbId, userId } },
    update: { content },
    create: { tmdbId, userId, content },
  });
}

export async function deleteReview(tmdbId: number, userId: number) {
  await prisma.review.deleteMany({ where: { tmdbId, userId } });
}
