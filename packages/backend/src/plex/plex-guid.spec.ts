import { describe, expect, it } from 'vitest';
import { findGuid, parsePlexGuid } from './plex-guid.js';

describe('parsePlexGuid', () => {
  it('parses an imdb guid', () => {
    expect(parsePlexGuid('imdb://tt1234567')).toEqual({ source: 'imdb', id: 'tt1234567' });
  });

  it('parses a tmdb guid', () => {
    expect(parsePlexGuid('tmdb://12345')).toEqual({ source: 'tmdb', id: '12345' });
  });

  it('parses a tvdb guid', () => {
    expect(parsePlexGuid('tvdb://67890')).toEqual({ source: 'tvdb', id: '67890' });
  });

  it('never matches the primary plex:// guid', () => {
    expect(parsePlexGuid('plex://movie/5d776b59ad5437001f79c6f8')).toBeNull();
  });

  it('returns null for an unsupported source', () => {
    expect(parsePlexGuid('anidb://12345')).toBeNull();
  });

  it('returns null for a malformed guid', () => {
    expect(parsePlexGuid('not-a-guid')).toBeNull();
  });

  it('returns null when the id portion is empty', () => {
    expect(parsePlexGuid('imdb://')).toBeNull();
  });
});

describe('findGuid', () => {
  it('finds the first matching guid for a source', () => {
    const guids = [{ id: 'plex://movie/abc' }, { id: 'imdb://tt1234567' }, { id: 'tmdb://12345' }];

    expect(findGuid(guids, 'imdb')).toBe('tt1234567');
    expect(findGuid(guids, 'tmdb')).toBe('12345');
  });

  it('returns null when no guid matches the source', () => {
    const guids = [{ id: 'plex://movie/abc' }, { id: 'tmdb://12345' }];

    expect(findGuid(guids, 'imdb')).toBeNull();
  });

  it('returns null when guids is undefined', () => {
    expect(findGuid(undefined, 'imdb')).toBeNull();
  });
});
