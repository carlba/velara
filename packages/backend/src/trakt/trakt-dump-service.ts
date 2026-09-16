import { unzipSync } from 'fflate';
import { z } from 'zod';
import type { TraktExport, TraktHistoryEntry, TraktRatingEntry } from './trakt.types.js';

const traktIdsSchema = z
  .object({
    trakt: z.number().optional(),
    slug: z.string().nullish(),
    tvdb: z.number().nullish(),
    imdb: z.string().nullish(),
    tmdb: z.number().nullish(),
  })
  .passthrough();

const traktMovieSchema = z.object({
  title: z.string(),
  year: z.number().nullish(),
  ids: traktIdsSchema,
});

const traktShowSchema = z.object({
  title: z.string(),
  year: z.number().nullish(),
  ids: traktIdsSchema,
  aired_episodes: z.number().optional(),
});

const traktEpisodeSchema = z.object({
  season: z.number(),
  number: z.number(),
  title: z.string().optional(),
  ids: traktIdsSchema.optional(),
});

const traktDumpRatingMovieSchema = z.object({
  rated_at: z.string(),
  rating: z.number(),
  type: z.literal('movie'),
  movie: traktMovieSchema,
});

const traktDumpRatingShowSchema = z.object({
  rated_at: z.string(),
  rating: z.number(),
  type: z.literal('show'),
  show: traktShowSchema,
});

const traktDumpRatingEpisodeSchema = z.object({
  rated_at: z.string(),
  rating: z.number(),
  type: z.literal('episode'),
  episode: traktEpisodeSchema,
  show: traktShowSchema,
});

const traktDumpRatingEntrySchema = z.union([
  traktDumpRatingMovieSchema,
  traktDumpRatingShowSchema,
  traktDumpRatingEpisodeSchema,
]);

const traktDumpHistoryMovieSchema = z.object({
  id: z.number(),
  watched_at: z.string(),
  action: z.enum(['watch', 'scrobble', 'checkin']),
  type: z.literal('movie'),
  movie: traktMovieSchema,
});

const traktDumpHistoryEpisodeSchema = z.object({
  id: z.number(),
  watched_at: z.string(),
  action: z.enum(['watch', 'scrobble', 'checkin']),
  type: z.literal('episode'),
  episode: traktEpisodeSchema,
  show: traktShowSchema,
});

const traktDumpHistoryEntrySchema = z.union([
  traktDumpHistoryMovieSchema,
  traktDumpHistoryEpisodeSchema,
]);

interface DumpFileMatcher {
  prefix: string;
  numbered: boolean;
}

const RATING_MATCHERS: DumpFileMatcher[] = [
  { prefix: 'ratings-movies-', numbered: true },
  { prefix: 'ratings-shows', numbered: false },
  { prefix: 'ratings-episodes-', numbered: true },
];

const HISTORY_MATCHERS: DumpFileMatcher[] = [{ prefix: 'watched-history-', numbered: true }];

function matchesFile(filename: string, matcher: DumpFileMatcher): boolean {
  if (!filename.endsWith('.json')) {
    return false;
  }

  if (matcher.numbered) {
    return new RegExp(`^${matcher.prefix}\\d+\\.json$`).test(filename);
  }

  return filename === `${matcher.prefix}.json`;
}

const TRAILING_NUMBER_PATTERN = /(\d+)\.json$/;

function extractTrailingNumber(filename: string): number {
  return Number(TRAILING_NUMBER_PATTERN.exec(filename)?.[1] ?? 0);
}

function sortDumpFilenames(filenames: string[]): string[] {
  return [...filenames].sort(
    (first, second) => extractTrailingNumber(first) - extractTrailingNumber(second)
  );
}

function collectMatchedFilenames(allFilenames: string[], matchers: DumpFileMatcher[]): string[] {
  return sortDumpFilenames(
    allFilenames.filter(filename => matchers.some(matcher => matchesFile(filename, matcher)))
  );
}

export class TraktDumpParseError extends Error {}

export function parseTraktDump(zipBuffer: Buffer): Pick<TraktExport, 'ratings' | 'history'> {
  let unzipped: ReturnType<typeof unzipSync>;
  try {
    unzipped = unzipSync(new Uint8Array(zipBuffer));
  } catch (error) {
    throw new TraktDumpParseError(
      `Failed to read data dump zip: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  const allFilenames = Object.keys(unzipped);
  const ratingFilenames = collectMatchedFilenames(allFilenames, RATING_MATCHERS);
  const historyFilenames = collectMatchedFilenames(allFilenames, HISTORY_MATCHERS);

  if (ratingFilenames.length === 0 && historyFilenames.length === 0) {
    throw new TraktDumpParseError('No recognized Trakt data dump files were found in the zip');
  }

  const decoder = new TextDecoder();

  const readJsonEntries = <T>(filename: string, schema: z.ZodType<T>): T[] => {
    const raw = unzipped[filename];
    if (!raw) {
      throw new TraktDumpParseError(`Missing expected file contents for ${filename}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(decoder.decode(raw));
    } catch (error) {
      throw new TraktDumpParseError(
        `Failed to parse ${filename}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const arraySchema = z.array(schema);
    const result = arraySchema.safeParse(parsed);
    if (!result.success) {
      throw new TraktDumpParseError(
        `Failed to validate ${filename}: ${JSON.stringify(z.treeifyError(result.error))}`
      );
    }

    return result.data;
  };

  const ratings: TraktRatingEntry[] = ratingFilenames.flatMap(filename =>
    readJsonEntries(filename, traktDumpRatingEntrySchema)
  );

  const history: TraktHistoryEntry[] = historyFilenames.flatMap(filename =>
    readJsonEntries(filename, traktDumpHistoryEntrySchema)
  );

  return { ratings, history };
}
