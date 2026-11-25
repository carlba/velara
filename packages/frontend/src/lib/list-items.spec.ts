import { describe, expect, it } from 'vitest';
import {
  buildSeriesItemPayload,
  getSeasonNumbers,
  toMovieResults,
  toSeriesResults,
} from './list-items';
import type { MovieListItem } from '@/types/movie';
import type { TvShowListItem } from '@/types/tv-show';

const movie: MovieListItem = {
  tmdbId: 603,
  title: 'The Matrix',
  posterPath: null,
  backdropPath: null,
  voteAverage: 8,
  voteCount: 100,
  releaseDate: '1999-03-30',
  overview: '',
};

const show: TvShowListItem = {
  seriesTmdbId: '1396',
  name: 'Breaking Bad',
  posterPath: null,
  backdropPath: null,
  voteAverage: 9,
  voteCount: 100,
  firstAirDate: '2008-01-20',
  overview: '',
};

describe('toMovieResults', () => {
  it('maps a movie to a result with its release year', () => {
    expect(toMovieResults([movie])).toEqual([
      { id: 'movie-603', tmdbId: 603, title: 'The Matrix', year: '1999', posterPath: null },
    ]);
  });

  it('has no year when the release date is empty', () => {
    expect(toMovieResults([{ ...movie, releaseDate: '' }])[0].year).toBeNull();
  });

  it('limits the number of results', () => {
    const movies = Array.from({ length: 20 }, (_, tmdbId) => ({ ...movie, tmdbId }));

    expect(toMovieResults(movies)).toHaveLength(6);
  });
});

describe('toSeriesResults', () => {
  it('maps a show to a result with its first air year', () => {
    expect(toSeriesResults([show])).toEqual([
      {
        id: 'series-1396',
        seriesTmdbId: '1396',
        title: 'Breaking Bad',
        year: '2008',
        posterPath: null,
      },
    ]);
  });
});

describe('buildSeriesItemPayload', () => {
  it('adds the whole series when no season is picked', () => {
    expect(buildSeriesItemPayload({ seriesTmdbId: '1396' })).toEqual({
      type: 'series',
      seriesTmdbId: '1396',
    });
  });

  it('adds a season when no episode is picked', () => {
    expect(buildSeriesItemPayload({ seriesTmdbId: '1396', seasonNumber: 2 })).toEqual({
      type: 'season',
      seriesTmdbId: '1396',
      seasonNumber: 2,
    });
  });

  it('adds an episode when a season and episode are picked', () => {
    expect(
      buildSeriesItemPayload({ seriesTmdbId: '1396', seasonNumber: 2, episodeNumber: 5 })
    ).toEqual({ type: 'episode', seriesTmdbId: '1396', seasonNumber: 2, episodeNumber: 5 });
  });

  it('keeps episode number zero', () => {
    expect(
      buildSeriesItemPayload({ seriesTmdbId: '1396', seasonNumber: 1, episodeNumber: 0 }).type
    ).toBe('episode');
  });
});

describe('getSeasonNumbers', () => {
  it('numbers seasons from one', () => {
    expect(getSeasonNumbers(3)).toEqual([1, 2, 3]);
  });

  it('is empty for a show without seasons', () => {
    expect(getSeasonNumbers(0)).toEqual([]);
  });
});
