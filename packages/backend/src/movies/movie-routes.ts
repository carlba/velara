import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { HTTPError } from 'got';
import { z } from 'zod';
import { authenticate } from '../auth/auth-middleware.js';
import { createMovieService } from './movie-service.js';
import { createUserDataService } from './user-data-service.js';
import { createWatchService } from '../watch/watch-service.js';
import { createRatingService } from '../ratings/rating-service.js';
import { createReviewService } from '../reviews/review-service.js';
import { createCommentService } from '../comments/comment-service.js';
import { importRatingsFromFilmtipset } from './import-service.js';
import { USER_FILTER_VALUES } from './movie-types.js';
import type { SortBy, UserFilterValue } from './movie-types.js';

const PAGE_SIZE = 20;

const listQuerySchema = z.object({
  search: z.string().optional(),
  tmdb_id: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  sort_by: z.enum(['popularity', 'rating', 'watched_date', 'my_rating']).default('popularity'),
  user_filter: z
    .string()
    .transform(raw => raw.split(',').filter(Boolean))
    .pipe(z.array(z.enum(USER_FILTER_VALUES)))
    .optional(),
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

const commentBodySchema = z.object({
  content: z.string().min(1).max(1000),
});

const deleteCommentParamsSchema = z.object({
  tmdbId: z.coerce.number().int().positive(),
  commentId: z.coerce.number().int().positive(),
});

const importBodySchema = z.object({
  content: z.string().min(1),
});

function handleNotFound(error: unknown): never {
  if (error instanceof HTTPError && error.response.statusCode === 404) {
    throw Object.assign(new Error('Movie not found', { cause: error }), { statusCode: 404 });
  }
  throw error;
}

const SORT_REQUIRED_FILTER: Partial<Record<SortBy, UserFilterValue>> = {
  watched_date: 'watched',
  my_rating: 'rated',
};

export const movieRoutes: FastifyPluginCallbackZod = (fastify, _options, done) => {
  fastify.get('/', { schema: { querystring: listQuerySchema } }, async (request, reply) => {
    const { tmdb_id, search, page, sort_by, user_filter } = request.query;

    const requiredFilter = SORT_REQUIRED_FILTER[sort_by];
    if (requiredFilter !== undefined && !user_filter?.includes(requiredFilter)) {
      return reply
        .code(400)
        .send({ error: `sort_by=${sort_by} requires user_filter to include "${requiredFilter}"` });
    }

    if (tmdb_id !== undefined) {
      const movieService = createMovieService({ logger: request.log });
      const movie = await movieService.getMovieById(tmdb_id).catch(handleNotFound);
      return reply.send({ results: [movie], page: 1, total_pages: 1, total_results: 1 });
    }

    if (search) {
      const movieService = createMovieService({ logger: request.log });
      const data = await movieService.searchMovies(search, page);
      return reply.send(data);
    }

    if (user_filter && user_filter.length > 0) {
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const userDataService = createUserDataService({ logger: request.log });
      const tmdbIds = await userDataService.getFilteredTmdbIds(
        request.user.userId,
        user_filter,
        sort_by
      );

      if (tmdbIds.length === 0) {
        return reply.send({ results: [], page: 1, total_pages: 1, total_results: 0 });
      }

      const totalResults = tmdbIds.length;
      const totalPages = Math.ceil(totalResults / PAGE_SIZE);
      const pageIds = tmdbIds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      const movieService = createMovieService({ logger: request.log });
      const results = await Promise.all(pageIds.map(id => movieService.getMovieById(id)));
      return reply.send({ results, page, total_pages: totalPages, total_results: totalResults });
    }

    const movieService = createMovieService({ logger: request.log });
    const data = await movieService.discoverMovies(sort_by, page);
    return reply.send(data);
  });

  fastify.get('/:tmdbId', { schema: { params: paramsSchema } }, async (request, reply) => {
    const movieService = createMovieService({ logger: request.log });
    const movie = await movieService.getMovieDetails(request.params.tmdbId).catch(handleNotFound);
    return reply.send(movie);
  });

  fastify.get(
    '/:tmdbId/user-data',
    { preHandler: authenticate, schema: { params: paramsSchema } },
    async (request, reply) => {
      const userDataService = createUserDataService({ logger: request.log });
      const data = await userDataService.getUserMovieData(
        request.params.tmdbId,
        request.user.userId
      );
      return reply.send(data);
    }
  );

  fastify.get('/:tmdbId/comments', { schema: { params: paramsSchema } }, async (request, reply) => {
    const commentService = createCommentService({ logger: request.log });
    const comments = await commentService.getCommentsForMovie(request.params.tmdbId);
    return reply.send(comments);
  });

  fastify.post(
    '/:tmdbId/comments',
    {
      preHandler: authenticate,
      schema: { params: paramsSchema, body: commentBodySchema },
    },
    async (request, reply) => {
      const commentService = createCommentService({ logger: request.log });
      const comment = await commentService.createComment(
        request.params.tmdbId,
        request.user.userId,
        request.body.content
      );
      return reply.send(comment);
    }
  );

  fastify.delete(
    '/:tmdbId/comments/:commentId',
    {
      preHandler: authenticate,
      schema: { params: deleteCommentParamsSchema },
    },
    async (request, reply) => {
      const commentService = createCommentService({ logger: request.log });
      await commentService.deleteComment(
        request.params.tmdbId,
        request.params.commentId,
        request.user.userId
      );
      return reply.code(204).send();
    }
  );

  fastify.post(
    '/import',
    { preHandler: authenticate, schema: { body: importBodySchema } },
    async (request, reply) => {
      const summary = await importRatingsFromFilmtipset(request.user.userId, request.body.content);
      return reply.send(summary);
    }
  );

  fastify.put(
    '/:tmdbId/watch',
    { preHandler: authenticate, schema: { params: paramsSchema, body: watchBodySchema } },
    async (request, reply) => {
      const watchService = createWatchService({ logger: request.log });
      const entry = await watchService.getOrCreateWatchEntry(
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
      const watchService = createWatchService({ logger: request.log });
      await watchService.deleteWatchEntry(request.params.tmdbId, request.user.userId);
      return reply.code(204).send();
    }
  );

  fastify.put(
    '/:tmdbId/rating',
    { preHandler: authenticate, schema: { params: paramsSchema, body: ratingBodySchema } },
    async (request, reply) => {
      const ratingService = createRatingService({ logger: request.log });
      const rating = await ratingService.upsertRating(
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
      const ratingService = createRatingService({ logger: request.log });
      await ratingService.deleteRating(request.params.tmdbId, request.user.userId);
      return reply.code(204).send();
    }
  );

  fastify.put(
    '/:tmdbId/review',
    { preHandler: authenticate, schema: { params: paramsSchema, body: reviewBodySchema } },
    async (request, reply) => {
      const reviewService = createReviewService({ logger: request.log });
      const review = await reviewService.upsertReview(
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
      const reviewService = createReviewService({ logger: request.log });
      await reviewService.deleteReview(request.params.tmdbId, request.user.userId);
      return reply.code(204).send();
    }
  );

  done();
};
