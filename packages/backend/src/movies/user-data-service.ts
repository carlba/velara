import { prisma } from '../lib/prisma.js';

export async function getUserMovieData(tmdbId: number, userId: number) {
  const [watchEntry, rating, review] = await Promise.all([
    prisma.watchEntry.findUnique({ where: { tmdbId_userId: { tmdbId, userId } } }),
    prisma.rating.findUnique({ where: { tmdbId_userId: { tmdbId, userId } } }),
    prisma.review.findUnique({ where: { tmdbId_userId: { tmdbId, userId } } }),
  ]);

  return {
    watchEntry: watchEntry ? { watchedAt: watchEntry.watchedAt } : null,
    rating: rating ? { score: rating.score } : null,
    review: review ? { content: review.content } : null,
  };
}
