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

/**
 * For public routes that personalise their response when a session exists.
 * An absent or invalid token is expected here, so it is treated as anonymous rather than as an error.
 */
export async function getOptionalUserId(request: FastifyRequest): Promise<number | null> {
  try {
    await request.jwtVerify();
    return request.user.userId;
  } catch (error) {
    request.log.debug({ err: error }, 'No valid session; serving anonymous response');
    return null;
  }
}
