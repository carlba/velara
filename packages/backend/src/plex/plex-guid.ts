import type { PlexGuid } from './plex.types.js';

const SUPPORTED_GUID_SOURCES = ['imdb', 'tmdb', 'tvdb'] as const;

export type PlexGuidSource = (typeof SUPPORTED_GUID_SOURCES)[number];

export interface ParsedPlexGuid {
  source: PlexGuidSource;
  id: string;
}

export function parsePlexGuid(guid: string): ParsedPlexGuid | null {
  const separatorIndex = guid.indexOf('://');
  if (separatorIndex === -1) return null;

  const source = guid.slice(0, separatorIndex);
  const id = guid.slice(separatorIndex + 3);

  if (!id || !isSupportedGuidSource(source)) return null;

  return { source, id };
}

export function findGuid(guids: PlexGuid[] | undefined, source: PlexGuidSource): string | null {
  if (!guids) return null;

  for (const guid of guids) {
    const parsed = parsePlexGuid(guid.id);
    if (parsed?.source === source) {
      return parsed.id;
    }
  }

  return null;
}

function isSupportedGuidSource(source: string): source is PlexGuidSource {
  return (SUPPORTED_GUID_SOURCES as readonly string[]).includes(source);
}
