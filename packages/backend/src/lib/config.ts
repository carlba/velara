import { z } from 'zod';
export type { Config } from '../schema.js';

export interface ConfigLogger {
  info(message: unknown, ...args: unknown[]): void;
  error(message: unknown, ...args: unknown[]): void;
}

export const parseConfig = <Schema extends z.ZodType>(schema: Schema, env = process.env) =>
  schema.safeParse(env);

/**
 * Parse and validate config from an environment object.
 *
 * Throws if the environment is invalid, so callers can consume a fully
 * validated config object without additional type checks.
 *
 * @param schema - The Zod schema to validate against.
 * @param env - The environment object to parse; defaults to process.env.
 * @returns The validated config values.
 */
export const getConfig = <Schema extends z.ZodType>(
  schema: Schema,
  env = process.env
): z.infer<Schema> => {
  const result = parseConfig(schema, env);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
};

/**
 * Initialize config during app startup.
 *
 * Logs a fatal error and exits the process if the environment is invalid.
 *
 * @param schema - The Zod schema to validate against.
 * @param logger - A logger instance used to report validation failures.
 * @returns The validated config values.
 */
export const initConfig = <Schema extends z.ZodType>(
  schema: Schema,
  logger: ConfigLogger
): z.infer<Schema> => {
  const result = parseConfig(schema);

  if (!result.success) {
    logger.error({ issues: result.error.issues }, 'Failed to read the config');
    process.exit(1);
  }
  return result.data;
};
