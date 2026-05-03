import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyJwt from '@fastify/jwt';
import { config, LOGGER } from './registry.js';
import { authRoutes } from './auth/auth-routes.js';
import { movieRoutes } from './movies/movie-routes.js';
import { tvRoutes } from './tv-shows/tv-show-routes.js';

const logger = LOGGER.child({ module: 'index' });

const server = Fastify({
  loggerInstance: LOGGER,
  bodyLimit: 50 * 1024 * 1024,
}).withTypeProvider<ZodTypeProvider>();
server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.setErrorHandler((error: unknown, request, reply) => {
  if (error instanceof Error && error.constructor.name === 'ZodError') {
    request.log.warn({ err: error, issues: (error as ZodError).issues }, 'Validation error');
    return reply.code(400).send({ error: 'Validation error' });
  }

  if (error instanceof Error) {
    const fastifyError = error as FastifyError;
    if (typeof fastifyError.statusCode === 'number' && fastifyError.statusCode < 500) {
      request.log.warn({ err: error, statusCode: fastifyError.statusCode }, 'Client error');
      return reply.code(fastifyError.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'Unhandled server error');
  }

  return reply.code(500).send({ error: 'Internal server error' });
});

await server.register(fastifyHelmet);
await server.register(fastifyCors, {
  origin: config.CORS_ORIGIN,
  credentials: true,
});
await server.register(fastifyCookie);
await server.register(fastifyJwt, {
  secret: config.JWT_SECRET,
  cookie: {
    cookieName: 'velara_token',
    signed: false,
  },
});

await server.register(authRoutes, { prefix: '/api/auth' });
await server.register(movieRoutes, { prefix: '/api/movies' });
await server.register(tvRoutes, { prefix: '/api/tv' });

server.get('/health', () => ({ status: 'ok' }));

await server.listen({ port: config.PORT, host: '0.0.0.0' });
logger.info(`Server listening on port ${config.PORT}`);
