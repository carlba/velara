import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { authenticate } from '../auth/auth-middleware.js';
import { createFlexgetService } from './flexget-service.js';
import { createListService } from '../lists/list-service.js';

const integrationBodySchema = z.object({
  baseUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const flexgetRoutes: FastifyPluginCallbackZod = (fastify, _options, done) => {
  const flexgetService = createFlexgetService({ logger: fastify.log });

  fastify.get('/integration', { preHandler: authenticate }, async (request, reply) => {
    const integration = await flexgetService.getIntegration(request.user.userId);
    if (!integration) {
      return reply.code(404).send({ error: 'Flexget integration not configured' });
    }

    return reply.send({
      baseUrl: integration.baseUrl,
      username: integration.username,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    });
  });

  fastify.post(
    '/integration',
    { preHandler: authenticate, schema: { body: integrationBodySchema } },
    async (request, reply) => {
      const integration = await flexgetService.upsertIntegration(
        request.user.userId,
        request.body.baseUrl,
        request.body.username,
        request.body.password
      );
      return reply.code(201).send({
        baseUrl: integration.baseUrl,
        username: integration.username,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      });
    }
  );

  fastify.delete('/integration', { preHandler: authenticate }, async (request, reply) => {
    await flexgetService.deleteIntegration(request.user.userId);
    return reply.code(204).send();
  });

  fastify.get('/remote-lists', { preHandler: authenticate }, async (request, reply) => {
    const integration = await flexgetService.ensureIntegration(request.user.userId);
    const lists = await flexgetService.getRemoteEntryLists(integration);
    return reply.send(lists);
  });

  const importFlexgetListBodySchema = z.object({
    remoteListId: z.coerce.number().int().positive(),
  });

  fastify.post(
    '/import',
    { preHandler: authenticate, schema: { body: importFlexgetListBodySchema } },
    async (request, reply) => {
      const listService = createListService({ logger: request.log });
      const list = await listService.importFlexgetList(
        request.body.remoteListId,
        request.user.userId
      );
      return reply.code(201).send(list);
    }
  );

  done();
};
