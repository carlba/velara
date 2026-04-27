import { describe, expect, it } from 'vitest';
import { HttpError } from './http-error.js';

describe('HttpError', () => {
  it('preserves stack trace and status code', () => {
    const error = new HttpError('Not found', { statusCode: 404 });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('HttpError');
    expect(error.statusCode).toBe(404);
    expect(error.stack).toContain('HttpError');
  });

  it('preserves cause when provided', () => {
    const cause = new Error('cause reason');
    const error = new HttpError('Not found', { statusCode: 404, cause });

    expect(error.cause).toBe(cause);
  });
});
