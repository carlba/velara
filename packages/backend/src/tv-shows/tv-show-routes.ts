import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate, getOptionalUserId } from '../auth/auth-middleware.js';
import type { FastifyBaseLogger } from 'fastify';
import { HttpError } from '../lib/http-error.js';
import { createTvShowService } from './tv-show-service.js';
import { createTvUserDataService } from './tv-user-data-service.js';
import { createTvWatchService } from './tv-watch-service.js';
import { createTvRatingService } from './tv-rating-service.js';
import { createTvReviewService } from './tv-review-service.js';
import { createTvCommentService } from './tv-comment-service.js';
import { TV_USER_FILTER_VALUES } from './tv-show-types.js';
import type {
  TvShowListItem,
  TvShowListResponse,
  TvSortBy,
  TvUserFilterValue,
} from './tv-show-types.js';

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
  score: z.number().int().min(1).max(10),
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

const SORT_REQUIRED_FILTER: Partial<Record<TvSortBy, TvUserFilterValue>> = {
  watched_date: 'watched',
  my_rating: 'rated',
};

async function withMyRatings(
  list: TvShowListResponse,
  userId: number | null,
  userDataService: ReturnType<typeof createTvUserDataService>
): Promise<TvShowListResponse> {
  if (userId === null || list.results.length === 0) return list;

  const myRatings = await userDataService.getMyShowRatings(
    userId,
    list.results.map(show => show.seriesTmdbId)
  );
  const results: TvShowListItem[] = list.results.map(show => ({
    ...show,
    ...(myRatings[show.seriesTmdbId] !== undefined && { myRating: myRatings[show.seriesTmdbId] }),
  }));
  return { ...list, results };
}

interface LoadTvShowListOptions {
  query: z.infer<typeof listQuerySchema>;
  userId: number | null;
  logger: FastifyBaseLogger;
}

async function loadTvShowList({
  query,
  userId,
  logger,
}: LoadTvShowListOptions): Promise<TvShowListResponse> {
  const { series_id, search, page, sort_by, user_filter } = query;
  const tvService = createTvShowService({ logger });

  if (series_id !== undefined) {
    const show = await tvService.getTvShowById(series_id);
    return { results: [show], page: 1, total_pages: 1, total_results: 1 };
  }

  if (search) {
    return tvService.searchTvShows(search, page);
  }

  if (user_filter && user_filter.length > 0) {
    if (userId === null) throw new HttpError('Unauthorized', { statusCode: 401 });

    const userDataService = createTvUserDataService({ logger });
    const seriesIds = await userDataService.getFilteredSeriesTmdbIds(userId, user_filter, sort_by);
    const pageIds = seriesIds.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const results = await Promise.all(pageIds.map(id => tvService.getTvShowById(id)));
    return {
      results,
      page: seriesIds.length === 0 ? 1 : page,
      total_pages: Math.max(1, Math.ceil(seriesIds.length / PAGE_SIZE)),
      total_results: seriesIds.length,
    };
  }

  return tvService.discoverTvShows(sort_by, page);
}

export const tvRoutes: FastifyPluginCallbackZod = (fastify, _options, done) => {
  fastify.get('/', { schema: { querystring: listQuerySchema } }, async (request, reply) => {
    const { sort_by, user_filter } = request.query;

    const requiredFilter = SORT_REQUIRED_FILTER[sort_by];
    if (requiredFilter !== undefined && !user_filter?.includes(requiredFilter)) {
      return reply
        .code(400)
        .send({ error: `sort_by=${sort_by} requires user_filter to include "${requiredFilter}"` });
    }

    const userId = await getOptionalUserId(request);
    const list = await loadTvShowList({ query: request.query, userId, logger: request.log });
    const userDataService = createTvUserDataService({ logger: request.log });
    return reply.send(await withMyRatings(list, userId, userDataService));
  });

  fastify.get('/:seriesId', { schema: { params: seriesParamsSchema } }, async (request, reply) => {
    const tvService = createTvShowService({ logger: request.log });
    const show = await tvService.getTvShowDetails(request.params.seriesId);
    return reply.send(show);
  });

  fastify.get(
    '/:seriesId/season/:seasonNumber',
    { schema: { params: seriesSeasonParamsSchema } },
    async (request, reply) => {
      const tvService = createTvShowService({ logger: request.log });
      const season = await tvService.getTvSeason(
        request.params.seriesId,
        request.params.seasonNumber
      );
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
