import { describe, expect, it } from 'vitest';
import { plexWebhookPayloadSchema } from './plex.types.js';

describe('plexWebhookPayloadSchema', () => {
  it('accepts a movie payload', () => {
    const result = plexWebhookPayloadSchema.safeParse({
      event: 'media.scrobble',
      Metadata: { type: 'movie', Guid: [{ id: 'tmdb://12345' }] },
    });

    expect(result.success).toBe(true);
  });

  it('accepts a complete episode payload', () => {
    const result = plexWebhookPayloadSchema.safeParse({
      event: 'media.scrobble',
      Metadata: {
        type: 'episode',
        grandparentRatingKey: '63119',
        parentIndex: 2,
        index: 5,
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts an unsupported media type', () => {
    const result = plexWebhookPayloadSchema.safeParse({
      event: 'media.scrobble',
      Metadata: { type: 'track' },
    });

    expect(result.success).toBe(true);
  });

  it('rejects an episode payload missing season/episode numbers', () => {
    const result = plexWebhookPayloadSchema.safeParse({
      event: 'media.scrobble',
      Metadata: { type: 'episode', grandparentRatingKey: '63119' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an episode payload missing grandparentRatingKey', () => {
    const result = plexWebhookPayloadSchema.safeParse({
      event: 'media.scrobble',
      Metadata: { type: 'episode', parentIndex: 1, index: 1 },
    });

    expect(result.success).toBe(false);
  });
});
