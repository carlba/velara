import type { FastifyPluginCallback } from 'fastify';
import { HTTPError } from 'got';
import { z } from 'zod';
import { authenticate } from '../auth/auth-middleware.js';
import { searchMovies, discoverMovies, getMovieDetails, getMovieById } from './movie-service.js';
import { getOrCreateWatchEntry, deleteWatchEntry } from '../watch/watch-service.js';
import { upsertRating, deleteRating } from '../ratings/rating-service.js';
import { upsertReview, deleteReview } from '../reviews/review-service.js';
import { getUserMovieData } from './user-data-service.js';

const listQuerySchema = z.object({
  search: z.string().optional(),
  tmdb_id: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  sort_by: z.enum(['popularity', 'rating']).default('popularity'),
});

const paramsSchema = z.object({ tmdbId: z.coerce.number().int().positive() });

const watchBodySchema = z.object({
  watchedAt: z.string().datetime(),
});

const ratingBodySchema = z.object({
  score: z.number().int().min(1).max(5),
});

const reviewBodySchema = z.object({
  content: z.string().min(1).max(5000),
});

function handleNotFound(error: unknown): never {
  if (error instanceof HTTPError && error.response.statusCode === 404) {
    throw Object.assign(new Error('Movie not found', { cause: error }), { statusCode: 404 });
  }
  throw error;
}

export const movieRoutes: FastifyPluginCallback = (fastify, _options, done) => {
  fastify.get('/', async (request, reply) => {
    const query = listQuerySchema.parse(request.query);

    if (query.tmdb_id !== undefined) {
      const movie = await getMovieById(query.tmdb_id).catch(handleNotFound);
      return reply.send({ results: [movie], page: 1, total_pages: 1, total_results: 1 });
    }

    if (query.search) {
      const data = await searchMovies(query.search, query.page);
      return reply.send(data);
    }

    const data = await discoverMovies(query.sort_by, query.page);
    return reply.send(data);
  });

  fastify.get('/:tmdbId', async (request, reply) => {
    const { tmdbId } = paramsSchema.parse(request.params);
    const movie = await getMovieDetails(tmdbId).catch(handleNotFound);
    return reply.send(movie);
  });

  fastify.get('/:tmdbId/user-data', { preHandler: authenticate }, async (request, reply) => {
    const { tmdbId } = paramsSchema.parse(request.params);
    const data = await getUserMovieData(tmdbId, request.user.userId);
    return reply.send(data);
  });

  fastify.put('/:tmdbId/watch', { preHandler: authenticate }, async (request, reply) => {
    const { tmdbId } = paramsSchema.parse(request.params);
    const body = watchBodySchema.parse(request.body);
    const entry = await getOrCreateWatchEntry(
      tmdbId,
      request.user.userId,
      new Date(body.watchedAt)
    );
    return reply.send(entry);
  });

  fastify.delete('/:tmdbId/watch', { preHandler: authenticate }, async (request, reply) => {
    const { tmdbId } = paramsSchema.parse(request.params);
    await deleteWatchEntry(tmdbId, request.user.userId);
    return reply.code(204).send();
  });

  fastify.put('/:tmdbId/rating', { preHandler: authenticate }, async (request, reply) => {
    const { tmdbId } = paramsSchema.parse(request.params);
    const body = ratingBodySchema.parse(request.body);
    const rating = await upsertRating(tmdbId, request.user.userId, body.score);
    return reply.send(rating);
  });

  fastify.delete('/:tmdbId/rating', { preHandler: authenticate }, async (request, reply) => {
    const { tmdbId } = paramsSchema.parse(request.params);
    await deleteRating(tmdbId, request.user.userId);
    return reply.code(204).send();
  });

  fastify.put('/:tmdbId/review', { preHandler: authenticate }, async (request, reply) => {
    const { tmdbId } = paramsSchema.parse(request.params);
    const body = reviewBodySchema.parse(request.body);
    const review = await upsertReview(tmdbId, request.user.userId, body.content);
    return reply.send(review);
  });

  fastify.delete('/:tmdbId/review', { preHandler: authenticate }, async (request, reply) => {
    const { tmdbId } = paramsSchema.parse(request.params);
    await deleteReview(tmdbId, request.user.userId);
    return reply.code(204).send();
  });

  done();
};
