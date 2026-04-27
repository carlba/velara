import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

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

export async function registerUser(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  return prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
    },
    select: { id: true, email: true, username: true, createdAt: true },
  });
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) return null;

  const isValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isValid) return null;

  return { id: user.id, email: user.email, username: user.username };
}

export async function getUserById(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, createdAt: true },
  });
}
