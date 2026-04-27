import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
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

export const movieRoutes: FastifyPluginCallbackZod = (fastify, _options, done) => {
  fastify.get('/', { schema: { querystring: listQuerySchema } }, async (request, reply) => {
    const { tmdb_id, search, page, sort_by } = request.query;

    if (tmdb_id !== undefined) {
      const movie = await getMovieById(tmdb_id).catch(handleNotFound);
      return reply.send({ results: [movie], page: 1, total_pages: 1, total_results: 1 });
    }

    if (search) {
      const data = await searchMovies(search, page);
      return reply.send(data);
    }

    const data = await discoverMovies(sort_by, page);
    return reply.send(data);
  });

  fastify.get('/:tmdbId', { schema: { params: paramsSchema } }, async (request, reply) => {
    const movie = await getMovieDetails(request.params.tmdbId).catch(handleNotFound);
    return reply.send(movie);
  });

  fastify.get(
    '/:tmdbId/user-data',
    { preHandler: authenticate, schema: { params: paramsSchema } },
    async (request, reply) => {
      const data = await getUserMovieData(request.params.tmdbId, request.user.userId);
      return reply.send(data);
    }
  );

  fastify.put(
    '/:tmdbId/watch',
    { preHandler: authenticate, schema: { params: paramsSchema, body: watchBodySchema } },
    async (request, reply) => {
      const entry = await getOrCreateWatchEntry(
        request.params.tmdbId,
        request.user.userId,
        new Date(request.body.watchedAt)
      );
      return reply.send(entry);
    }
  );

  fastify.delete(
    '/:tmdbId/watch',
    { preHandler: authenticate, schema: { params: paramsSchema } },
    async (request, reply) => {
      await deleteWatchEntry(request.params.tmdbId, request.user.userId);
      return reply.code(204).send();
    }
  );

  fastify.put(
    '/:tmdbId/rating',
    { preHandler: authenticate, schema: { params: paramsSchema, body: ratingBodySchema } },
    async (request, reply) => {
      const rating = await upsertRating(
        request.params.tmdbId,
        request.user.userId,
        request.body.score
      );
      return reply.send(rating);
    }
  );

  fastify.delete(
    '/:tmdbId/rating',
    { preHandler: authenticate, schema: { params: paramsSchema } },
    async (request, reply) => {
      await deleteRating(request.params.tmdbId, request.user.userId);
      return reply.code(204).send();
    }
  );

  fastify.put(
    '/:tmdbId/review',
    { preHandler: authenticate, schema: { params: paramsSchema, body: reviewBodySchema } },
    async (request, reply) => {
      const review = await upsertReview(
        request.params.tmdbId,
        request.user.userId,
        request.body.content
      );
      return reply.send(review);
    }
  );

  fastify.delete(
    '/:tmdbId/review',
    { preHandler: authenticate, schema: { params: paramsSchema } },
    async (request, reply) => {
      await deleteReview(request.params.tmdbId, request.user.userId);
      return reply.code(204).send();
    }
  );

  done();
};
