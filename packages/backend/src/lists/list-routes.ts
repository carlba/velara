import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../auth/auth-middleware.js';
import { createListService } from './list-service.js';

const listQuerySchema = z.object({
  mine: z.coerce.boolean().optional(),
});

const paramsSchema = z.object({ listId: z.coerce.number().int().positive() });

const createListBodySchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(200).optional(),
});

const updateListBodySchema = createListBodySchema
  .partial()
  .refine(value => value.title !== undefined || value.description !== undefined, {
    message: 'At least one field is required',
  });

const listItemBodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('movie'), movieTmdbId: z.coerce.number().int().positive() }),
  z.object({ type: z.literal('series'), seriesTmdbId: z.string().min(1) }),
  z.object({
    type: z.literal('season'),
    seriesTmdbId: z.string().min(1),
    seasonNumber: z.coerce.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('episode'),
    seriesTmdbId: z.string().min(1),
    seasonNumber: z.coerce.number().int().nonnegative(),
    episodeNumber: z.coerce.number().int().nonnegative(),
  }),
]);

const flexgetConnectionBodySchema = z.object({
  entryListName: z.string().min(1).max(100),
});

export const listRoutes: FastifyPluginCallbackZod = (fastify, _options, done) => {
  fastify.get('/', { schema: { querystring: listQuerySchema } }, async (request, reply) => {
    const listService = createListService({ logger: request.log });
    const mine = request.query.mine ?? false;

    if (mine) {
      try {
        await request.jwtVerify();
      } catch {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    }

    const lists = await listService.getLists(request.user?.userId, mine);
    const results = lists.map(({ _count, ...list }) => ({
      ...list,
      itemCount: _count.items,
    }));
    return reply.send(results);
  });

  fastify.get('/:listId', { schema: { params: paramsSchema } }, async (request, reply) => {
    const listService = createListService({ logger: request.log });
    const list = await listService.getListById(request.params.listId);
    return reply.send(list);
  });

  fastify.post(
    '/',
    { preHandler: authenticate, schema: { body: createListBodySchema } },
    async (request, reply) => {
      const listService = createListService({ logger: request.log });
      const list = await listService.createList(
        request.body.title,
        request.body.description,
        request.user.userId
      );
      return reply.code(201).send(list);
    }
  );

  fastify.patch(
    '/:listId',
    { preHandler: authenticate, schema: { params: paramsSchema, body: updateListBodySchema } },
    async (request, reply) => {
      const listService = createListService({ logger: request.log });
      const list = await listService.updateList(
        request.params.listId,
        request.body,
        request.user.userId
      );
      return reply.send(list);
    }
  );

  fastify.delete(
    '/:listId',
    { preHandler: authenticate, schema: { params: paramsSchema } },
    async (request, reply) => {
      const listService = createListService({ logger: request.log });
      await listService.deleteList(request.params.listId, request.user.userId);
      return reply.code(204).send();
    }
  );

  fastify.post(
    '/:listId/items',
    {
      preHandler: authenticate,
      schema: { params: paramsSchema, body: listItemBodySchema },
    },
    async (request, reply) => {
      const listService = createListService({ logger: request.log });
      const item = await listService.addItem(
        request.params.listId,
        request.body,
        request.user.userId
      );
      return reply.code(201).send(item);
    }
  );

  fastify.delete(
    '/:listId/items/:itemId',
    {
      preHandler: authenticate,
      schema: {
        params: z.object({
          listId: z.coerce.number().int().positive(),
          itemId: z.coerce.number().int().positive(),
        }),
      },
    },
    async (request, reply) => {
      const { listId, itemId } = request.params;
      const listService = createListService({ logger: request.log });
      await listService.deleteItem(listId, itemId, request.user.userId);
      return reply.code(204).send();
    }
  );

  fastify.get(
    '/:listId/flexget',
    { preHandler: authenticate, schema: { params: paramsSchema } },
    async (request, reply) => {
      const listService = createListService({ logger: request.log });
      const connection = await listService.getListFlexgetConnection(
        request.params.listId,
        request.user.userId
      );
      if (!connection) {
        return reply.code(404).send({ error: 'Flexget connection not found' });
      }
      return reply.send(connection);
    }
  );

  fastify.put(
    '/:listId/flexget',
    {
      preHandler: authenticate,
      schema: { params: paramsSchema, body: flexgetConnectionBodySchema },
    },
    async (request, reply) => {
      const listService = createListService({ logger: request.log });
      const connection = await listService.connectListToFlexget(
        request.params.listId,
        request.body.entryListName,
        request.user.userId
      );
      return reply.send(connection);
    }
  );

  fastify.delete(
    '/:listId/flexget',
    { preHandler: authenticate, schema: { params: paramsSchema } },
    async (request, reply) => {
      const listService = createListService({ logger: request.log });
      await listService.disconnectListFromFlexget(request.params.listId, request.user.userId);
      return reply.code(204).send();
    }
  );

  done();
};
