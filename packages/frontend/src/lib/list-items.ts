import type { AddListItemPayload } from '@/types/list';
import type { MovieListItem } from '@/types/movie';
import type { TvShowListItem } from '@/types/tv-show';

const MAX_RESULTS_PER_TYPE = 6;

export interface TitleResult {
  id: string;
  title: string;
  year: string | null;
  posterPath: string | null;
}

export interface MovieResult extends TitleResult {
  tmdbId: number;
}

export interface SeriesResult extends TitleResult {
  seriesTmdbId: string;
}

export interface SeriesSelection {
  seriesTmdbId: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

function getYear(date: string | undefined): string | null {
  return date ? date.slice(0, 4) : null;
}

export function toMovieResults(movies: MovieListItem[]): MovieResult[] {
  return movies.slice(0, MAX_RESULTS_PER_TYPE).map(movie => ({
    id: `movie-${movie.tmdbId}`,
    tmdbId: movie.tmdbId,
    title: movie.title,
    year: getYear(movie.releaseDate),
    posterPath: movie.posterPath,
  }));
}

export function toSeriesResults(shows: TvShowListItem[]): SeriesResult[] {
  return shows.slice(0, MAX_RESULTS_PER_TYPE).map(show => ({
    id: `series-${show.seriesTmdbId}`,
    seriesTmdbId: show.seriesTmdbId,
    title: show.name,
    year: getYear(show.firstAirDate),
    posterPath: show.posterPath,
  }));
}

/** The narrowest part of the series that was picked decides the item type. */
export function buildSeriesItemPayload({
  seriesTmdbId,
  seasonNumber,
  episodeNumber,
}: SeriesSelection): AddListItemPayload {
  if (seasonNumber === undefined) {
    return { type: 'series', seriesTmdbId };
  }
  if (episodeNumber === undefined) {
    return { type: 'season', seriesTmdbId, seasonNumber };
  }
  return { type: 'episode', seriesTmdbId, seasonNumber, episodeNumber };
}

export function getSeasonNumbers(numberOfSeasons: number): number[] {
  return Array.from({ length: numberOfSeasons }, (_, index) => index + 1);
}
