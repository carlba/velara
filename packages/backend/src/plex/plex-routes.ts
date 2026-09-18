import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import fastifyMultipart from '@fastify/multipart';
import { authenticate } from '../auth/auth-middleware.js';
import { createPlexService } from './plex-service.js';
import { plexWebhookPayloadSchema } from './plex.types.js';

const webhookParamsSchema = z.object({ token: z.string().min(1) });

export const plexRoutes: FastifyPluginCallbackZod = (fastify, _options, done) => {
  const plexService = createPlexService({ logger: fastify.log });

  fastify.register(fastifyMultipart, { attachFieldsToBody: false });

  fastify.get('/integration', { preHandler: authenticate }, async (request, reply) => {
    const integration = await plexService.getIntegration(request.user.userId);
    if (!integration) {
      return reply.code(404).send({ error: 'Plex integration not configured' });
    }

    return reply.send({
      webhookToken: integration.webhookToken,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    });
  });

  fastify.post('/integration', { preHandler: authenticate }, async (request, reply) => {
    const integration = await plexService.createOrRotateIntegration(request.user.userId);
    return reply.code(201).send({
      webhookToken: integration.webhookToken,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    });
  });

  fastify.delete('/integration', { preHandler: authenticate }, async (request, reply) => {
    await plexService.deleteIntegration(request.user.userId);
    return reply.code(204).send();
  });

  fastify.get('/now-playing', { preHandler: authenticate }, async (request, reply) => {
    return reply.send(plexService.getNowPlaying(request.user.userId));
  });

  fastify.post(
    '/webhook/:token',
    { schema: { params: webhookParamsSchema } },
    async (request, reply) => {
      const localLog = request.log.child({ module: 'plex-routes', context: 'webhook' });
      const integration = await plexService.getIntegrationByToken(request.params.token);

      if (!integration) {
        localLog.warn({ token: request.params.token }, 'Rejected Plex webhook for unknown token');
        return reply.code(404).send({ error: 'Unknown Plex webhook token' });
      }

      const requestLog = localLog.child({ userId: integration.userId });

      let rawPayload: unknown;

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          requestLog.debug(
            { fieldname: part.fieldname, filename: part.filename },
            'Discarding unexpected file part on Plex webhook'
          );
          continue;
        }

        if (part.fieldname === 'payload') {
          rawPayload = part.value;
        } else {
          requestLog.debug({ fieldname: part.fieldname }, 'Ignoring unexpected form field');
        }
      }

      if (rawPayload === undefined) {
        requestLog.warn('Rejected Plex webhook with no payload field');
        return reply.code(400).send({ error: 'Missing payload field' });
      }

      const parsedPayload = plexWebhookPayloadSchema.safeParse(rawPayload);
      if (!parsedPayload.success) {
        requestLog.warn(
          { err: z.prettifyError(parsedPayload.error), rawPayload },
          'Failed to parse Plex webhook payload'
        );
        return reply.code(400).send({ error: 'Invalid payload' });
      }

      const payload = parsedPayload.data;

      requestLog.info(
        { event: payload.event, mediaType: payload.Metadata?.type },
        'Received Plex webhook'
      );

      try {
        await plexService.handleWebhookPayload(integration.userId, payload);
      } catch (error) {
        requestLog.error({ err: error, event: payload.event }, 'Failed to handle Plex webhook');
        throw error;
      }

      requestLog.debug({ event: payload.event }, 'Finished handling Plex webhook');
      return reply.code(200).send({ received: true });
    }
  );

  done();
};
