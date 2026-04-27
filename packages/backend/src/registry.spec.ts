import { afterEach, describe, expect, it, vi } from 'vitest';

const childMock = vi.fn().mockReturnValue({ child: vi.fn() });
const createLoggerMock = vi.fn().mockReturnValue({ child: childMock });

vi.mock('./lib/logger.js', () => ({
  createLogger: createLoggerMock,
}));

describe('registry module', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.assign(process.env, originalEnv);
  });

  it('boots a production logger and then creates a config logger', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
    process.env.TMDB_API_KEY = 'test-tmdb-key';
    process.env.OMDB_API_KEY = 'test-omdb-key';
    process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-chars!!';

    const { config, LOGGER } = await import('./registry.js');

    expect(config.NODE_ENV).toBe('test');
    expect(createLoggerMock).toHaveBeenNthCalledWith(1, undefined, 'production');
    expect(createLoggerMock).toHaveBeenNthCalledWith(2, undefined, 'test');
    expect(childMock).toHaveBeenCalledTimes(2);
    expect(typeof LOGGER.child).toBe('function');
  });
});
