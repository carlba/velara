import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { config } from '../registry.js';
import { registerUser, loginUser, getUserById } from './auth-service.js';
import { authenticate } from './auth-middleware.js';

const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const registerBodySchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8),
});

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes: FastifyPluginCallback = (fastify, _options, done) => {
  fastify.post('/register', async (request, reply) => {
    const body = registerBodySchema.parse(request.body);
    const user = await registerUser(body);

    const token = fastify.jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      { expiresIn: '7d' }
    );

    reply.setCookie('velara_token', token, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: !config.isDevelopment,
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });

    return reply.code(201).send({ user });
  });

  fastify.post('/login', async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const user = await loginUser(body);

    if (!user) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const token = fastify.jwt.sign(
      { userId: user.id, email: user.email, username: user.username },
      { expiresIn: '7d' }
    );

    reply.setCookie('velara_token', token, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: !config.isDevelopment,
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });

    return reply.send({ user });
  });

  fastify.post('/logout', async (_request, reply) => {
    reply.clearCookie('velara_token', { path: '/' });
    return reply.send({ success: true });
  });

  fastify.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const user = await getUserById(request.user.userId);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    return reply.send({ user });
  });

  done();
};
