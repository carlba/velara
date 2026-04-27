import { afterEach, describe, expect, it, vi } from 'vitest';

const childMock = vi.fn().mockReturnValue({ child: vi.fn() });
const createLoggerMock = vi.fn().mockReturnValue({ child: childMock });

vi.mock('./lib/logger.js', () => ({
  createLogger: createLoggerMock,
}));

describe('registry module', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('boots a production logger and then creates a config logger', async () => {
    process.env.NODE_ENV = 'test';
    const { config, LOGGER } = await import('./registry.js');

    expect(config.NODE_ENV).toBe('test');
    expect(createLoggerMock).toHaveBeenNthCalledWith(1, undefined, 'production');
    expect(createLoggerMock).toHaveBeenNthCalledWith(2, undefined, 'test');
    expect(childMock).toHaveBeenCalledTimes(2);
    expect(typeof LOGGER.child).toBe('function');
  });

  it('uses package.json name for logger binding', async () => {
    process.env.NODE_ENV = 'development';
    const { bootstrapLogger } = await import('./registry.js');

    expect(createLoggerMock).toHaveBeenCalledWith(undefined, 'production');
    expect(childMock).toHaveBeenCalledWith({ name: 'typescript-template' });
    expect(typeof bootstrapLogger.child).toBe('function');
  });
});
