import bcrypt from 'bcryptjs';
import type { FastifyBaseLogger } from 'fastify';
import type { Logger } from 'pino';
import { prisma } from '../lib/prisma.js';
import { LOGGER } from '../registry.js';

type ServiceLogger = Logger | FastifyBaseLogger;

interface ServiceOptions {
  logger?: ServiceLogger;
}

const SALT_ROUNDS = 12;

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export function createAuthService(options?: ServiceOptions) {
  const serviceLogger = options?.logger ?? LOGGER;

  const localLogger = (context: string) => serviceLogger.child({ module: 'auth-service', context });

  return {
    async registerUser(input: RegisterInput) {
      const logger = localLogger('registerUser');
      logger.debug({ email: input.email }, 'Registering user');

      const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
      return prisma.user.create({
        data: {
          email: input.email,
          username: input.username,
          passwordHash,
        },
        select: { id: true, email: true, username: true, createdAt: true },
      });
    },

    async loginUser(input: LoginInput) {
      const logger = localLogger('loginUser');
      logger.debug({ email: input.email }, 'Logging in user');

      const user = await prisma.user.findUnique({ where: { email: input.email } });
      if (!user) return null;

      const isValid = await bcrypt.compare(input.password, user.passwordHash);
      if (!isValid) return null;

      return { id: user.id, email: user.email, username: user.username };
    },

    async getUserById(userId: number) {
      const logger = localLogger('getUserById');
      logger.debug({ userId }, 'Fetching user by id');

      return prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, username: true, createdAt: true },
      });
    },
  };
}
