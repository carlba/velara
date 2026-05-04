export type ListItemType = 'movie' | 'series' | 'season' | 'episode';

export interface ListSummary {
  id: number;
  title: string;
  description: string | null;
  creator: {
    id: number;
    username: string;
  };
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListItem {
  id: number;
  type: ListItemType;
  movieTmdbId?: number;
  seriesTmdbId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListFlexgetConnection {
  entryListName: string;
  remoteListId: number;
}

export interface ListDetails extends ListSummary {
  items: ListItem[];
  flexgetConnection?: ListFlexgetConnection | null;
}

export interface CreateListPayload {
  title: string;
  description?: string;
}

export interface UpdateListPayload {
  title?: string;
  description?: string;
}

export interface AddListItemPayload {
  type: ListItemType;
  movieTmdbId?: number;
  seriesTmdbId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}
