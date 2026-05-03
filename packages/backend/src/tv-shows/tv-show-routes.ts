import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { HTTPError } from 'got';
import { z } from 'zod';
import { authenticate } from '../auth/auth-middleware.js';
import { HttpError } from '../lib/http-error.js';
import { importTvFromTrakt } from '../movies/import-service.js';
import { createTvShowService } from './tv-show-service.js';
import { createTvUserDataService } from './tv-user-data-service.js';
import { createTvWatchService } from './tv-watch-service.js';
import { createTvRatingService } from './tv-rating-service.js';
import { createTvReviewService } from './tv-review-service.js';
import { createTvCommentService } from './tv-comment-service.js';
import { TV_USER_FILTER_VALUES } from './tv-show-types.js';
import type { TvSortBy, TvUserFilterValue } from './tv-show-types.js';

const PAGE_SIZE = 20;

const listQuerySchema = z.object({
  search: z.string().optional(),
  series_id: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  sort_by: z.enum(['popularity', 'rating', 'watched_date', 'my_rating']).default('popularity'),
  user_filter: z
    .string()
    .transform(raw => raw.split(',').filter(Boolean))
    .pipe(z.array(z.enum(TV_USER_FILTER_VALUES)))
    .optional(),
});

const seriesParamsSchema = z.object({ seriesId: z.string().min(1) });

const seriesSeasonParamsSchema = z.object({
  seriesId: z.string().min(1),
  seasonNumber: z.coerce.number().int().min(0),
});

const watchBodySchema = z.object({
  seasonNumber: z.number().int().min(1),
  episodeNumber: z.number().int().min(1),
  watchedAt: z.string().datetime(),
});

const unwatchBodySchema = z.object({
  seasonNumber: z.number().int().min(1),
  episodeNumber: z.number().int().min(1),
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
  seriesId: z.string().min(1),
  commentId: z.coerce.number().int().positive(),
});

function handleNotFound(error: unknown): never {
  if (error instanceof HTTPError && error.response.statusCode === 404) {
    throw new HttpError('TV show not found', { statusCode: 404, cause: error });
  }
  throw error;
}

const SORT_REQUIRED_FILTER: Partial<Record<TvSortBy, TvUserFilterValue>> = {
  watched_date: 'watched',
  my_rating: 'rated',
};

const importBodySchema = z.object({
  content: z.string().min(1),
});

export const tvRoutes: FastifyPluginCallbackZod = (fastify, _options, done) => {
  fastify.post(
    '/import',
    { preHandler: authenticate, schema: { body: importBodySchema } },
    async (request, reply) => {
      const summary = await importTvFromTrakt(request.user.userId, request.body.content, {
        logger: request.log,
      });
      return reply.send(summary);
    }
  );

  fastify.get('/', { schema: { querystring: listQuerySchema } }, async (request, reply) => {
    const { series_id, search, page, sort_by, user_filter } = request.query;

    const requiredFilter = SORT_REQUIRED_FILTER[sort_by];
    if (requiredFilter !== undefined && !user_filter?.includes(requiredFilter)) {
      return reply
        .code(400)
        .send({ error: `sort_by=${sort_by} requires user_filter to include "${requiredFilter}"` });
    }

    if (series_id !== undefined) {
      const tvService = createTvShowService({ logger: request.log });
      const show = await tvService.getTvShowById(series_id).catch(handleNotFound);
      return reply.send({ results: [show], page: 1, total_pages: 1, total_results: 1 });
    }

    if (search) {
      const tvService = createTvShowService({ logger: request.log });
      const data = await tvService.searchTvShows(search, page);
      return reply.send(data);
    }

    if (user_filter && user_filter.length > 0) {
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const userDataService = createTvUserDataService({ logger: request.log });
      const seriesIds = await userDataService.getFilteredSeriesTmdbIds(
        request.user.userId,
        user_filter,
        sort_by
      );

      if (seriesIds.length === 0) {
        return reply.send({ results: [], page: 1, total_pages: 1, total_results: 0 });
      }

      const totalResults = seriesIds.length;
      const totalPages = Math.ceil(totalResults / PAGE_SIZE);
      const pageIds = seriesIds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      const tvService = createTvShowService({ logger: request.log });
      const results = await Promise.all(pageIds.map(id => tvService.getTvShowById(id)));
      return reply.send({ results, page, total_pages: totalPages, total_results: totalResults });
    }

    const tvService = createTvShowService({ logger: request.log });
    const data = await tvService.discoverTvShows(sort_by, page);
    return reply.send(data);
  });

  fastify.get('/:seriesId', { schema: { params: seriesParamsSchema } }, async (request, reply) => {
    const tvService = createTvShowService({ logger: request.log });
    const show = await tvService.getTvShowDetails(request.params.seriesId).catch(handleNotFound);
    return reply.send(show);
  });

  fastify.get(
    '/:seriesId/season/:seasonNumber',
    { schema: { params: seriesSeasonParamsSchema } },
    async (request, reply) => {
      const tvService = createTvShowService({ logger: request.log });
      const season = await tvService
        .getTvSeason(request.params.seriesId, request.params.seasonNumber)
        .catch(handleNotFound);
      return reply.send(season);
    }
  );

  fastify.get(
    '/:seriesId/user-data',
    { preHandler: authenticate, schema: { params: seriesParamsSchema } },
    async (request, reply) => {
      const userDataService = createTvUserDataService({ logger: request.log });
      const data = await userDataService.getUserTvData(
        request.params.seriesId,
        request.user.userId
      );
      return reply.send(data);
    }
  );

  fastify.get(
    '/:seriesId/comments',
    { schema: { params: seriesParamsSchema } },
    async (request, reply) => {
      const commentService = createTvCommentService({ logger: request.log });
      const comments = await commentService.getCommentsForSeries(request.params.seriesId);
      return reply.send(comments);
    }
  );

  fastify.post(
    '/:seriesId/comments',
    {
      preHandler: authenticate,
      schema: { params: seriesParamsSchema, body: commentBodySchema },
    },
    async (request, reply) => {
      const commentService = createTvCommentService({ logger: request.log });
      const comment = await commentService.createComment(
        request.params.seriesId,
        request.user.userId,
        request.body.content
      );
      return reply.send(comment);
    }
  );

  fastify.delete(
    '/:seriesId/comments/:commentId',
    {
      preHandler: authenticate,
      schema: { params: deleteCommentParamsSchema },
    },
    async (request, reply) => {
      const commentService = createTvCommentService({ logger: request.log });
      await commentService.deleteComment(
        request.params.seriesId,
        request.params.commentId,
        request.user.userId
      );
      return reply.code(204).send();
    }
  );

  fastify.put(
    '/:seriesId/rating',
    { preHandler: authenticate, schema: { params: seriesParamsSchema, body: ratingBodySchema } },
    async (request, reply) => {
      const ratingService = createTvRatingService({ logger: request.log });
      const rating = await ratingService.upsertTvRating(
        request.params.seriesId,
        0,
        request.user.userId,
        request.body.score
      );
      return reply.send(rating);
    }
  );

  fastify.delete(
    '/:seriesId/rating',
    { preHandler: authenticate, schema: { params: seriesParamsSchema } },
    async (request, reply) => {
      const ratingService = createTvRatingService({ logger: request.log });
      await ratingService.deleteTvRating(request.params.seriesId, 0, request.user.userId);
      return reply.code(204).send();
    }
  );

  fastify.put(
    '/:seriesId/season/:seasonNumber/rating',
    {
      preHandler: authenticate,
      schema: { params: seriesSeasonParamsSchema, body: ratingBodySchema },
    },
    async (request, reply) => {
      const ratingService = createTvRatingService({ logger: request.log });
      const rating = await ratingService.upsertTvRating(
        request.params.seriesId,
        request.params.seasonNumber,
        request.user.userId,
        request.body.score
      );
      return reply.send(rating);
    }
  );

  fastify.delete(
    '/:seriesId/season/:seasonNumber/rating',
    {
      preHandler: authenticate,
      schema: { params: seriesSeasonParamsSchema },
    },
    async (request, reply) => {
      const ratingService = createTvRatingService({ logger: request.log });
      await ratingService.deleteTvRating(
        request.params.seriesId,
        request.params.seasonNumber,
        request.user.userId
      );
      return reply.code(204).send();
    }
  );

  fastify.put(
    '/:seriesId/review',
    { preHandler: authenticate, schema: { params: seriesParamsSchema, body: reviewBodySchema } },
    async (request, reply) => {
      const reviewService = createTvReviewService({ logger: request.log });
      const review = await reviewService.upsertTvReview(
        request.params.seriesId,
        request.user.userId,
        request.body.content
      );
      return reply.send(review);
    }
  );

  fastify.delete(
    '/:seriesId/review',
    { preHandler: authenticate, schema: { params: seriesParamsSchema } },
    async (request, reply) => {
      const reviewService = createTvReviewService({ logger: request.log });
      await reviewService.deleteTvReview(request.params.seriesId, request.user.userId);
      return reply.code(204).send();
    }
  );

  fastify.put(
    '/:seriesId/watch',
    { preHandler: authenticate, schema: { params: seriesParamsSchema, body: watchBodySchema } },
    async (request, reply) => {
      const watchService = createTvWatchService({ logger: request.log });
      const entry = await watchService.markEpisodeWatched(
        request.params.seriesId,
        request.body.seasonNumber,
        request.body.episodeNumber,
        request.user.userId,
        new Date(request.body.watchedAt)
      );
      return reply.send(entry);
    }
  );

  fastify.delete(
    '/:seriesId/watch',
    { preHandler: authenticate, schema: { params: seriesParamsSchema, body: unwatchBodySchema } },
    async (request, reply) => {
      const watchService = createTvWatchService({ logger: request.log });
      await watchService.unmarkEpisodeWatched(
        request.params.seriesId,
        request.body.seasonNumber,
        request.body.episodeNumber,
        request.user.userId
      );
      return reply.code(204).send();
    }
  );

  done();
};
