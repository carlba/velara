import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { getConfig, initConfig } from './config.js';

const envSchema = z
  .object({
    NODE_ENV: z
      .string()
      .trim()
      .default('development')
      .pipe(z.enum(['production', 'development', 'test'])),
  })
  .transform(raw => ({
    NODE_ENV: raw.NODE_ENV,
    isDevelopment: raw.NODE_ENV !== 'production',
  }));

describe('config module', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('allows production, development, and test values', () => {
    expect(getConfig(envSchema, { NODE_ENV: 'production' })).toEqual({
      NODE_ENV: 'production',
      isDevelopment: false,
    });

    expect(getConfig(envSchema, { NODE_ENV: 'development' })).toEqual({
      NODE_ENV: 'development',
      isDevelopment: true,
    });

    expect(getConfig(envSchema, { NODE_ENV: 'test' })).toEqual({
      NODE_ENV: 'test',
      isDevelopment: true,
    });
  });

  it('defaults NODE_ENV to development when missing', () => {
    expect(getConfig(envSchema, {})).toEqual({
      NODE_ENV: 'development',
      isDevelopment: true,
    });
  });

  it('logs and exits when configuration is invalid', () => {
    process.env.NODE_ENV = 'dummy';
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };
    const errorSpy = logger.error as ReturnType<typeof vi.fn>;
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    expect(() => initConfig(envSchema, logger)).toThrow('process.exit called');
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][1]).toBe('Failed to read the config');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
