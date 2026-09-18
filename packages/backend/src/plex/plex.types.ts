import { z } from 'zod';

export const plexGuidSchema = z
  .object({
    id: z.string(),
  })
  .loose();

const plexMovieMetadataSchema = z
  .object({
    type: z.literal('movie'),
    Guid: z.array(plexGuidSchema).optional(),
    title: z.string().optional(),
    viewOffset: z.number().optional(),
    duration: z.number().optional(),
  })
  .loose();

const plexEpisodeMetadataSchema = z
  .object({
    type: z.literal('episode'),
    grandparentRatingKey: z.string(),
    parentIndex: z.number(),
    index: z.number(),
    Guid: z.array(plexGuidSchema).optional(),
    title: z.string().optional(),
    grandparentTitle: z.string().optional(),
    viewOffset: z.number().optional(),
    duration: z.number().optional(),
  })
  .loose();

const plexOtherMetadataSchema = z
  .object({
    type: z.string().refine(value => value !== 'movie' && value !== 'episode'),
    Guid: z.array(plexGuidSchema).optional(),
    title: z.string().optional(),
    viewOffset: z.number().optional(),
    duration: z.number().optional(),
  })
  .loose();

export const plexMetadataSchema = z.union([
  plexMovieMetadataSchema,
  plexEpisodeMetadataSchema,
  plexOtherMetadataSchema,
]);

export const plexSessionSchema = z
  .object({
    id: z.string().optional(),
  })
  .loose();

export const plexWebhookPayloadSchema = z
  .object({
    event: z.string(),
    Metadata: plexMetadataSchema.optional(),
    Session: plexSessionSchema.optional(),
  })
  .loose();

export type PlexGuid = z.infer<typeof plexGuidSchema>;
export type PlexMovieMetadata = z.infer<typeof plexMovieMetadataSchema>;
export type PlexEpisodeMetadata = z.infer<typeof plexEpisodeMetadataSchema>;
export type PlexMetadata = z.infer<typeof plexMetadataSchema>;
export type PlexSession = z.infer<typeof plexSessionSchema>;
export type PlexWebhookPayload = z.infer<typeof plexWebhookPayloadSchema>;

export function isPlexMovieMetadata(metadata: PlexMetadata): metadata is PlexMovieMetadata {
  return metadata.type === 'movie';
}

export function isPlexEpisodeMetadata(metadata: PlexMetadata): metadata is PlexEpisodeMetadata {
  return metadata.type === 'episode';
}

export type NowPlayingResponse =
  | { isPlaying: false }
  | {
      isPlaying: true;
      status: 'playing' | 'paused';
      mediaType: 'movie' | 'episode';
      title: string;
      posterPath: string | null;
      tmdbId?: number;
      seriesTmdbId?: string;
      seriesName?: string;
      seasonNumber?: number;
      episodeNumber?: number;
      episodeName?: string;
      stillPath?: string | null;
      viewOffsetMs: number | null;
      durationMs: number | null;
      updatedAt: string;
    };
