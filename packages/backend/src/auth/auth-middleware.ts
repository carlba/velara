import type { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch (error) {
    request.log.warn(
      { err: error, method: request.method, url: request.raw.url },
      'JWT verification failed'
    );
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
}
