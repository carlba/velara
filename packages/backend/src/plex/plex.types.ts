import { z } from 'zod';

export const plexGuidSchema = z
  .object({
    id: z.string(),
  })
  .loose();

export const plexMetadataSchema = z
  .object({
    type: z.string(),
    Guid: z.array(plexGuidSchema).optional(),
    parentIndex: z.number().optional(),
    index: z.number().optional(),
    grandparentRatingKey: z.string().optional(),
  })
  .loose();

export const plexWebhookPayloadSchema = z
  .object({
    event: z.string(),
    Metadata: plexMetadataSchema.optional(),
  })
  .loose();

export type PlexGuid = z.infer<typeof plexGuidSchema>;
export type PlexMetadata = z.infer<typeof plexMetadataSchema>;
export type PlexWebhookPayload = z.infer<typeof plexWebhookPayloadSchema>;
