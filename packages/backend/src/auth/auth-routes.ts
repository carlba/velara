import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { config } from '../registry.js';
import { authenticate } from './auth-middleware.js';
import { createAuthService } from './auth-service.js';

const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const authCookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: config.isDevelopment ? 'lax' : 'none',
  secure: !config.isDevelopment,
  maxAge: COOKIE_MAX_AGE_SECONDS,
} as const;

const registerBodySchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes: FastifyPluginCallbackZod = (fastify, _options, done) => {
  fastify.post('/register', { schema: { body: registerBodySchema } }, async (request, reply) => {
    const authService = createAuthService({ logger: request.log });
    const user = await authService.registerUser(request.body);

    const token = fastify.jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      { expiresIn: '7d' }
    );

    reply.setCookie('velara_token', token, authCookieOptions);

    return reply.code(201).send({ user });
  });

  fastify.post('/login', { schema: { body: loginBodySchema } }, async (request, reply) => {
    const authService = createAuthService({ logger: request.log });
    const user = await authService.loginUser(request.body);

    if (!user) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const token = fastify.jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      { expiresIn: '7d' }
    );

    reply.setCookie('velara_token', token, authCookieOptions);

    return reply.send({ user });
  });

  fastify.post('/logout', async (_request, reply) => {
    reply.clearCookie('velara_token', {
      path: '/',
      sameSite: config.isDevelopment ? 'lax' : 'none',
      secure: !config.isDevelopment,
    });
    return reply.send({ success: true });
  });

  fastify.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const authService = createAuthService({ logger: request.log });
    const user = await authService.getUserById(request.user.userId);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    return reply.send({ user });
  });

  done();
};
