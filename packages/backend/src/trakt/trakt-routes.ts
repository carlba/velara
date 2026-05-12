import { z } from 'zod';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { authenticate } from '../auth/auth-middleware.js';
import { createTraktService } from './trakt-service.js';

const redirectUriSchema = z.object({ redirectUri: z.string().url() });
const connectBodySchema = z.object({
  authorizationCode: z.string().min(1),
  redirectUri: z.string().url(),
});

export const traktRoutes: FastifyPluginCallbackZod = (fastify, _options, done) => {
  const traktService = createTraktService({ logger: fastify.log });

  fastify.get(
    '/auth-url',
    { preHandler: authenticate, schema: { querystring: redirectUriSchema } },
    request => {
      return {
        url: traktService.getAuthorizationUrl(request.query.redirectUri),
      };
    }
  );

  fastify.get('/integration', { preHandler: authenticate }, async request => {
    const integration = await traktService.getIntegration(request.user.userId);
    if (!integration) {
      return { active: false };
    }

    return {
      active: true,
      traktUsername: integration.traktUsername,
      traktSlug: integration.traktSlug,
      lastSyncedAt: integration.lastSyncedAt,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  });

  fastify.post(
    '/integration',
    { preHandler: authenticate, schema: { body: connectBodySchema } },
    async request => {
      const integration = await traktService.createIntegrationFromAuthorizationCode(
        request.user.userId,
        request.body.authorizationCode,
        request.body.redirectUri
      );

      return {
        active: true,
        traktUsername: integration.traktUsername,
        traktSlug: integration.traktSlug,
        lastSyncedAt: integration.lastSyncedAt,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      };
    }
  );

  fastify.delete('/integration', { preHandler: authenticate }, async request => {
    await traktService.deleteIntegration(request.user.userId);
    return { active: false };
  });

  done();
};
