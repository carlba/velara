import { z } from 'zod';

export const historyTypeFilterSchema = z.enum(['movies', 'shows', 'both']).default('both');

export const historyQuerySchema = z.object({
  type: historyTypeFilterSchema,
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(100).default(30),
});

export const historyDeleteParamsSchema = z.object({
  type: z.enum(['movie', 'episode']),
  id: z.coerce.number().int().positive(),
});

export const historyItemSchema = z.object({
  historyId: z.number(),
  mediaType: z.enum(['movie', 'episode']),
  watchedAt: z.string().datetime(),
  tmdbId: z.number().optional(),
  title: z.string(),
  posterPath: z.string().nullable(),
  releaseYear: z.number().nullable().optional(),
  seriesTmdbId: z.string().optional(),
  seriesName: z.string().optional(),
  seasonNumber: z.number().optional(),
  episodeNumber: z.number().optional(),
  episodeName: z.string().optional(),
  stillPath: z.string().nullable().optional(),
});

export const historyResponseSchema = z.object({
  items: z.array(historyItemSchema),
  nextCursor: z.string().datetime().nullable(),
  hasMore: z.boolean(),
});

export type HistoryTypeFilter = z.infer<typeof historyTypeFilterSchema>;
export type HistoryItem = z.infer<typeof historyItemSchema>;
export type HistoryResponse = z.infer<typeof historyResponseSchema>;
