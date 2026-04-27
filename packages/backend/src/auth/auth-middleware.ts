import type { FastifyRequest, FastifyReply } from 'fastify';

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const localLog = request.log.child({ module: 'auth', context: authenticate.name });
  try {
    await request.jwtVerify();
  } catch (error) {
    localLog.warn(
      { err: error, method: request.method, url: request.raw.url },
      'JWT verification failed'
    );
    await reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
}
