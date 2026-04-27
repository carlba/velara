import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z
      .string()
      .trim()
      .default('development')
      .pipe(z.enum(['production', 'development', 'test'])),
    DATABASE_URL: z.string().url(),
    TMDB_API_KEY: z.string().min(1),
    OMDB_API_KEY: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    PORT: z.coerce.number().int().positive().default(3070),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
  })
  .transform(raw => ({
    NODE_ENV: raw.NODE_ENV,
    DATABASE_URL: raw.DATABASE_URL,
    TMDB_API_KEY: raw.TMDB_API_KEY,
    OMDB_API_KEY: raw.OMDB_API_KEY,
    JWT_SECRET: raw.JWT_SECRET,
    PORT: raw.PORT,
    CORS_ORIGIN: raw.CORS_ORIGIN,
    isDevelopment: raw.NODE_ENV !== 'production',
  }));

export type Config = z.infer<typeof envSchema>;
