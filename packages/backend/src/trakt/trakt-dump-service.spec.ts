import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseTraktDump, TraktDumpParseError } from './trakt-dump-service.js';

function buildZip(files: Record<string, unknown>): Buffer {
  const entries: Record<string, Uint8Array> = {};
  for (const [filename, content] of Object.entries(files)) {
    entries[filename] = strToU8(JSON.stringify(content));
  }
  return Buffer.from(zipSync(entries));
}

const sampleRatedMovie = {
  rated_at: '2026-07-26T20:22:16.000Z',
  rating: 8,
  type: 'movie',
  movie: {
    ids: {
      imdb: 'tt16708792',
      plex: { guid: '61cb2556d5576f24ba7c5f48', slug: 'lysande-jonssonligan-40-ar' },
      slug: 'lysande-jonssonligan-40-ar-2021',
      tmdb: 920399,
      trakt: 737301,
    },
    year: 2021,
    title: 'Lysande Jönssonligan - 40 år',
  },
};

const sampleRatedEpisode = {
  rated_at: '2025-11-17T06:15:39.000Z',
  rating: 9,
  type: 'episode',
  episode: {
    ids: { imdb: 'tt36944202', tmdb: 6231158, tvdb: 11160510, trakt: 12565635 },
    title: 'Goodbye',
    number: 10,
    season: 4,
  },
  show: {
    ids: { imdb: 'tt14452776', slug: 'the-bear', tmdb: 136315, tvdb: 403294, trakt: 189717 },
    year: 2022,
    title: 'The Bear',
    aired_episodes: 46,
  },
};

const sampleHistoryMovie = {
  id: 11890457894,
  watched_at: '2025-12-27T21:17:00.000Z',
  action: 'scrobble',
  type: 'movie',
  movie: {
    ids: { imdb: 'tt27543578', slug: 'good-fortune-2025', tmdb: 1114967, trakt: 897095 },
    year: 2025,
    title: 'Good Fortune',
  },
};

describe('parseTraktDump', () => {
  it('parses ratings and history entries from a data dump zip', () => {
    const zip = buildZip({
      'ratings-movies-1.json': [sampleRatedMovie],
      'ratings-episodes-1.json': [sampleRatedEpisode],
      'watched-history-2.json': [sampleHistoryMovie],
    });

    const result = parseTraktDump(zip);

    expect(result.ratings).toHaveLength(2);
    expect(result.ratings).toContainEqual(sampleRatedMovie);
    expect(result.ratings).toContainEqual(sampleRatedEpisode);
    expect(result.history).toEqual([sampleHistoryMovie]);
  });

  it('processes numbered files in numeric order, not lexical order', () => {
    const zip = buildZip({
      'watched-history-10.json': [{ ...sampleHistoryMovie, id: 10 }],
      'watched-history-2.json': [{ ...sampleHistoryMovie, id: 2 }],
    });

    const result = parseTraktDump(zip);

    expect(result.history.map(entry => entry.id)).toEqual([2, 10]);
  });

  it('accepts a null year, which real Trakt exports include for some movies', () => {
    const zip = buildZip({
      'ratings-movies-1.json': [
        {
          ...sampleRatedMovie,
          movie: { ...sampleRatedMovie.movie, year: null },
        },
      ],
    });

    const result = parseTraktDump(zip);

    expect(result.ratings).toHaveLength(1);
  });

  it('accepts a "checkin" history action alongside "watch" and "scrobble"', () => {
    const zip = buildZip({
      'watched-history-1.json': [{ ...sampleHistoryMovie, action: 'checkin' }],
    });

    const result = parseTraktDump(zip);

    expect(result.history).toHaveLength(1);
  });

  it('treats missing dump files as empty arrays rather than an error', () => {
    const zip = buildZip({
      'ratings-movies-1.json': [sampleRatedMovie],
    });

    const result = parseTraktDump(zip);

    expect(result.ratings).toEqual([sampleRatedMovie]);
    expect(result.history).toEqual([]);
  });

  it('throws when no recognized dump files are present', () => {
    const zip = buildZip({
      'user-profile.json': { username: 'carlba' },
    });

    expect(() => parseTraktDump(zip)).toThrow(TraktDumpParseError);
  });

  it('throws when a matched file contains malformed JSON', () => {
    const entries = {
      'ratings-movies-1.json': strToU8('{ not valid json'),
    };
    const zip = Buffer.from(zipSync(entries));

    expect(() => parseTraktDump(zip)).toThrow(TraktDumpParseError);
  });

  it('throws when a matched file fails schema validation', () => {
    const zip = buildZip({
      'ratings-movies-1.json': [{ rated_at: '2026-01-01T00:00:00.000Z', type: 'movie' }],
    });

    expect(() => parseTraktDump(zip)).toThrow(TraktDumpParseError);
  });

  it('throws when the buffer is not a valid zip', () => {
    const notAZip = Buffer.from('this is not a zip file');

    expect(() => parseTraktDump(notAZip)).toThrow(TraktDumpParseError);
  });
});
