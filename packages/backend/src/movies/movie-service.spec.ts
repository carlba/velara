import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from 'pino';

const errorSpy = vi.fn<(meta: { imdbId: string; err: unknown }, message: string) => void>();
const loggerMock = {
  child: vi.fn(() => loggerMock),
  error: errorSpy,
};

const tmdbGetMock = vi.fn();
const omdbGetMock = vi.fn();

vi.mock('../registry.js', () => ({ LOGGER: loggerMock }));
vi.mock('./tmdb-client.js', () => ({ tmdbClient: { get: tmdbGetMock } }));
vi.mock('./omdb-client.js', () => ({ omdbClient: { get: omdbGetMock } }));

describe('movie service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('logs an OMDB fetch error and returns null external ratings', async () => {
    const movieDetails = {
      id: 123,
      title: 'Test Movie',
      poster_path: null,
      backdrop_path: null,
      vote_average: 7.1,
      vote_count: 100,
      release_date: '2024-01-01',
      overview: 'Test overview',
      genres: [],
      runtime: 120,
      external_ids: { imdb_id: 'tt1234567' },
    };

    tmdbGetMock.mockReturnValue({ json: vi.fn().mockResolvedValue(movieDetails) });
    omdbGetMock.mockReturnValue({
      json: vi.fn().mockRejectedValue(new Error('OMDB request failed')),
    });

    const { createMovieService } = await import('./movie-service.js');
    const movieService = createMovieService({ logger: loggerMock as unknown as Logger });
    const movie = await movieService.getMovieDetails(123);

    expect(movie.externalRatings.imdbRating).toBeNull();
    expect(movie.externalRatings.rottenTomatoes).toBeNull();
    expect(omdbGetMock).toHaveBeenCalledWith(
      '',
      expect.objectContaining({ searchParams: { i: 'tt1234567' } })
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const [loggedMeta, loggedMessage] = errorSpy.mock.calls[0];
    expect(loggedMessage).toBe('Failed to fetch OMDB data');
    expect(loggedMeta).toEqual(expect.objectContaining({ imdbId: 'tt1234567' }));
    expect(loggedMeta.err).toBeInstanceOf(Error);
  });

  it('returns a failed lookup result when TMDB returns TV results', async () => {
    tmdbGetMock.mockReturnValue({
      json: vi.fn().mockResolvedValue({
        movie_results: [],
        tv_results: [{ id: 42 }],
        person_results: [],
        tv_episode_results: [],
        tv_season_results: [],
      }),
    });

    const { createMovieService } = await import('./movie-service.js');
    const movieService = createMovieService({ logger: loggerMock as unknown as Logger });
    const result = await movieService.findMovieByImdbId('tt1234567');

    expect(result).toEqual({
      success: false,
      reason: 'tv_results',
      message: 'TMDB returned TV results instead of movie results',
    });
  });
});
