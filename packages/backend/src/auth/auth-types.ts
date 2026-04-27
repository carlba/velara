export interface JwtPayload {
  userId: number;
  email: string;
  username: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
