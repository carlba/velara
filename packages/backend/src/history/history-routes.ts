import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { authenticate } from '../auth/auth-middleware.js';
import { createHistoryService } from './history-service.js';
import { historyDeleteParamsSchema, historyQuerySchema } from './history-types.js';

export const historyRoutes: FastifyPluginCallbackZod = (fastify, _options, done) => {
  fastify.get(
    '/',
    { preHandler: authenticate, schema: { querystring: historyQuerySchema } },
    async (request, reply) => {
      const historyService = createHistoryService({ logger: request.log });
      const { type, before, limit } = request.query;

      const page = await historyService.getHistoryPage({
        userId: request.user.userId,
        type,
        before,
        limit,
      });

      return reply.send(page);
    }
  );

  fastify.delete(
    '/:type/:id',
    { preHandler: authenticate, schema: { params: historyDeleteParamsSchema } },
    async (request, reply) => {
      const historyService = createHistoryService({ logger: request.log });
      const { type, id } = request.params;

      if (type === 'movie') {
        await historyService.deleteMovieHistoryRecord(id, request.user.userId);
      } else {
        await historyService.deleteEpisodeHistoryRecord(id, request.user.userId);
      }

      return reply.code(204).send();
    }
  );

  done();
};
