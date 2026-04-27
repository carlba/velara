import { afterEach, describe, expect, it, vi } from 'vitest';

describe('helloWorld', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns a greeting containing NODE_ENV', async () => {
    process.env.NODE_ENV = 'test';
    const { helloWorld } = await import('./index.js');

    expect(helloWorld()).toBe('Hello World! NODE_ENV is test');
  });
});
