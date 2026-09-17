import got, { HTTPError } from 'got';
import type { OptionsOfJSONResponseBody, ResponseType } from 'got';
import { z } from 'zod';

const plexMediaContainerSchema = z.object({
  MediaContainer: z.object({
    size: z.number().optional(),
    Metadata: z
      .array(
        z.object({
          ratingKey: z.string().optional(),
          Guid: z.array(z.object({ id: z.string() })).optional(),
        })
      )
      .optional(),
  }),
});

type PlexMediaContainer = z.infer<typeof plexMediaContainerSchema>;

export class PlexClient {
  private readonly http: ReturnType<typeof got.extend>;

  constructor(baseUrl: string, token: string) {
    const sharedConfig = {
      prefixUrl: baseUrl,
      headers: {
        Accept: 'application/json',
        'X-Plex-Token': token,
      },
      responseType: 'json' as ResponseType,
    };

    this.http = got.extend(sharedConfig);
  }

  private validate<T extends z.ZodTypeAny>(value: unknown, schema: T, path: string): z.infer<T> {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new Error(
        `${this.constructor.name} response validation failed ${z.prettifyError(parsed.error)} on path ${path}`,
        parsed.error
      );
    }
    return parsed.data;
  }

  private async apiRequest<T>(
    path: string,
    schema: z.ZodType<T>,
    options?: OptionsOfJSONResponseBody
  ): Promise<T> {
    let json: unknown;

    try {
      json = await this.http(path, options).json();
    } catch (error) {
      if (error instanceof HTTPError) {
        throw new Error(
          `${this.constructor.name} request failed: ${error.response.statusCode}`,
          error
        );
      } else if (error instanceof Error) {
        throw new Error(`${this.constructor.name} network error`, error);
      } else throw error;
    }

    return this.validate(json, schema, path);
  }

  async ping(): Promise<PlexMediaContainer> {
    try {
      return await this.apiRequest('identity', plexMediaContainerSchema);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`${this.constructor.name}: Failed to ping Plex server: ${error.message}`, {
          cause: error,
        });
      }
      throw error;
    }
  }

  async libraryMetadata(ratingKey: string): Promise<PlexMediaContainer> {
    try {
      return await this.apiRequest(`library/metadata/${ratingKey}`, plexMediaContainerSchema);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`${this.constructor.name}: Failed to ping Plex server: ${error.message}`, {
          cause: error,
        });
      }
      throw error;
    }
  }
}
