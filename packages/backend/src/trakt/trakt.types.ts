export interface TraktExport {
  type: 'full';
  username: string;
  followers: TraktUserSummary[];
  following: TraktUserSummary[];
  settings: TraktSettings;
  likes: unknown[];
  profile: TraktProfile;
  comments: TraktComment[];
  lists: TraktList[];
  ratings: TraktRatingEntry[];
  recommendations: TraktRecommendationEntry[];
  watchlist: TraktWatchlistEntry[];
  watched: TraktWatchedEntry[];
  stats: TraktStats;
  history: TraktHistoryEntry[];
  collection: TraktCollectionEntry[];
}

export interface TraktIds {
  trakt?: number;
  slug?: string | null;
  uuid?: string;
  tvdb?: number | null;
  imdb?: string | null;
  tmdb?: number | null;
  tvrage?: number | null;
  plex_guid?: string | null;
}

export interface TraktAvatar {
  full: string;
}

export interface TraktImages {
  avatar?: TraktAvatar;
  posters?: unknown[];
}

export interface TraktUserIds {
  slug: string;
  trakt?: number;
  uuid?: string;
}

export interface TraktUserSummary {
  username: string;
  private: boolean;
  deleted: boolean;
  name?: string;
  vip?: boolean;
  vip_ep?: boolean;
  director?: boolean;
  ids: TraktUserIds;
  joined_at?: string;
  location?: string;
  about?: string;
  gender?: string | null;
  age?: number | null;
  images?: TraktImages;
  vip_og?: boolean;
  vip_years?: number;
  vip_cover_image?: string | null;
}

export interface TraktProfile {
  username: string;
  private: boolean;
  deleted: boolean;
  name: string;
  vip: boolean;
  vip_ep: boolean;
  director: boolean;
  ids: {
    slug: string;
  };
}

export interface TraktAccountSettings {
  timezone: string;
  date_format: string;
  time_24hr: boolean;
  cover_image: string | null;
  token: string | null;
  display_ads: boolean;
}

export interface TraktConnections {
  facebook: boolean;
  twitter: boolean;
  mastodon: boolean;
  google: boolean;
  tumblr: boolean;
  medium: boolean;
  slack: boolean;
  apple: boolean;
  dropbox: boolean;
  microsoft: boolean;
}

export interface TraktSharingText {
  watching: string;
  watched: string;
  rated: string | null;
}

export interface TraktCountLimit {
  count?: number;
  item_count?: number;
  recent_count?: number;
}

export interface TraktLimits {
  list: TraktCountLimit;
  watchlist: TraktCountLimit;
  favorites: TraktCountLimit;
  search: TraktCountLimit;
  collection: TraktCountLimit;
  notes: TraktCountLimit;
  saved_filters: TraktCountLimit;
  recommendations: TraktCountLimit;
}

export interface TraktPermissions {
  commenting: boolean;
  liking: boolean;
  following: boolean;
}

export interface TraktSettings {
  user: TraktUserSummary;
  account: TraktAccountSettings;
  connections: TraktConnections;
  sharing_text: TraktSharingText;
  limits: TraktLimits;
  permissions: TraktPermissions;
}

export interface TraktList {
  name: string;
  description: string;
  privacy: 'private' | 'public' | 'friends';
  share_link: string;
  type: 'personal';
  display_numbers: boolean;
  allow_comments: boolean;
  sort_by: string;
  sort_how: 'asc' | 'desc';
  created_at: string;
  updated_at: string;
  item_count: number;
  comment_count: number;
  likes: number;
  ids: {
    slug: string;
    trakt: number;
  };
  images: {
    posters: unknown[];
  };
  user: TraktUserSummary;
  total_count: number;
}

export interface TraktMovie {
  title: string;
  year: number;
  ids: TraktIds;
}

export interface TraktShow {
  title: string;
  year: number;
  ids: TraktIds;
  aired_episodes?: number;
}

export interface TraktEpisode {
  season: number;
  number: number;
  title?: string;
  ids?: TraktIds;
}

export interface TraktCollectionMetadata {
  media_type?: string;
  resolution?: string;
  hdr?: string | null;
  audio?: string | null;
  audio_channels?: string | null;
  '3d'?: boolean | null;
}

export interface TraktSeasonCollectedEpisode {
  number: number;
  collected_at: string;
}

export interface TraktSeasonCollection {
  number: number;
  episodes: TraktSeasonCollectedEpisode[];
}

export interface TraktSeasonWatchedEpisode {
  number: number;
  plays: number;
  last_watched_at: string;
}

export interface TraktSeasonWatched {
  number: number;
  episodes: TraktSeasonWatchedEpisode[];
}

export interface TraktRatedMovie {
  rated_at: string;
  rating: number;
  type: 'movie';
  movie: TraktMovie;
}

export interface TraktRatedShow {
  rated_at: string;
  rating: number;
  type: 'show';
  show: TraktShow;
}

export interface TraktRatedEpisode {
  rated_at: string;
  rating: number;
  type: 'episode';
  episode: TraktEpisode;
  show: TraktShow;
}

export type TraktRatingEntry = TraktRatedMovie | TraktRatedShow | TraktRatedEpisode;

export interface TraktRecommendationMovie {
  rank: number;
  id: number;
  listed_at: string;
  notes: string | null;
  type: 'movie';
  movie: TraktMovie;
}

export interface TraktRecommendationShow {
  rank: number;
  id: number;
  listed_at: string;
  notes: string | null;
  type: 'show';
  show: TraktShow;
}

export type TraktRecommendationEntry = TraktRecommendationMovie | TraktRecommendationShow;

export interface TraktWatchlistMovie {
  rank: number;
  id: number;
  listed_at: string;
  notes: string | null;
  type: 'movie';
  movie: TraktMovie;
}

export interface TraktWatchlistShow {
  rank: number;
  id: number;
  listed_at: string;
  notes: string | null;
  type: 'show';
  show: TraktShow;
}

export type TraktWatchlistEntry = TraktWatchlistMovie | TraktWatchlistShow;

export interface TraktWatchedMovie {
  plays: number;
  last_watched_at: string;
  last_updated_at: string;
  movie: TraktMovie;
}

export interface TraktWatchedShow {
  plays: number;
  last_watched_at: string;
  last_updated_at: string;
  reset_at: string | null;
  show: TraktShow;
  seasons: TraktSeasonWatched[];
}

export type TraktWatchedEntry = TraktWatchedMovie | TraktWatchedShow;

export interface TraktHistoryMovie {
  id: number;
  watched_at: string;
  action: 'watch' | 'scrobble';
  type: 'movie';
  movie: TraktMovie;
}

export interface TraktHistoryEpisode {
  id: number;
  watched_at: string;
  action: 'watch' | 'scrobble';
  type: 'episode';
  episode: TraktEpisode;
  show: TraktShow;
}

export type TraktHistoryEntry = TraktHistoryMovie | TraktHistoryEpisode;

export interface TraktLastActivitiesCategory {
  watched_at?: string;
  rated_at?: string;
  updated_at?: string;
}

export interface TraktLastActivities {
  all?: string;
  movies?: TraktLastActivitiesCategory;
  episodes?: TraktLastActivitiesCategory;
  shows?: TraktLastActivitiesCategory;
  seasons?: TraktLastActivitiesCategory;
  [key: string]: unknown;
}

export interface TraktCollectedMovie {
  collected_at: string;
  updated_at: string;
  type: 'movie';
  movie: TraktMovie;
  available_on?: string;
  metadata?: TraktCollectionMetadata;
}

export interface TraktCollectedShow {
  last_collected_at: string;
  last_updated_at: string;
  type: 'show';
  show: TraktShow;
  seasons: TraktSeasonCollection[];
}

export type TraktCollectionEntry = TraktCollectedMovie | TraktCollectedShow;

export interface TraktStatsMediaBucket {
  plays?: number;
  watched?: number;
  minutes?: number;
  collected?: number;
  ratings?: number;
  comments?: number;
}

export interface TraktStatsNetwork {
  friends: number;
  followers: number;
  following: number;
}

export interface TraktRatingsDistribution {
  '1': number;
  '2': number;
  '3': number;
  '4': number;
  '5': number;
  '6': number;
  '7': number;
  '8': number;
  '9': number;
  '10': number;
}

export interface TraktStatsRatings {
  total: number;
  distribution: TraktRatingsDistribution;
}

export interface TraktStats {
  movies: TraktStatsMediaBucket;
  shows: TraktStatsMediaBucket;
  seasons: TraktStatsMediaBucket;
  episodes: TraktStatsMediaBucket;
  network: TraktStatsNetwork;
  ratings: TraktStatsRatings;
}

export type TraktComment = Record<string, unknown>;
