-- Rename tables to snake_case
ALTER TABLE "User" RENAME TO "users";
ALTER TABLE "Review" RENAME TO "reviews";
ALTER TABLE "WatchEntry" RENAME TO "watch_entries";
ALTER TABLE "WatchHistory" RENAME TO "watch_histories";
ALTER TABLE "Rating" RENAME TO "ratings";
ALTER TABLE "Comment" RENAME TO "comments";
ALTER TABLE "TvWatchEntry" RENAME TO "tv_watch_entries";
ALTER TABLE "TvWatchHistory" RENAME TO "tv_watch_histories";
ALTER TABLE "TvRating" RENAME TO "tv_ratings";
ALTER TABLE "TvReview" RENAME TO "tv_reviews";
ALTER TABLE "TvComment" RENAME TO "tv_comments";
ALTER TABLE "List" RENAME TO "lists";
ALTER TABLE "ListItem" RENAME TO "list_items";
ALTER TABLE "FlexgetIntegration" RENAME TO "flexget_integrations";
ALTER TABLE "ListIntegration" RENAME TO "list_integrations";
ALTER TABLE "TraktIntegration" RENAME TO "trakt_integrations";
ALTER TABLE "PlexIntegration" RENAME TO "plex_integrations";

-- users
ALTER TABLE "users" RENAME COLUMN "passwordHash" TO "password_hash";
ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at";

-- reviews
ALTER TABLE "reviews" RENAME COLUMN "tmdbId" TO "tmdb_id";
ALTER TABLE "reviews" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "reviews" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "reviews" RENAME COLUMN "updatedAt" TO "updated_at";

-- watch_entries
ALTER TABLE "watch_entries" RENAME COLUMN "tmdbId" TO "tmdb_id";
ALTER TABLE "watch_entries" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "watch_entries" RENAME COLUMN "latestWatchedAt" TO "latest_watched_at";
ALTER TABLE "watch_entries" RENAME COLUMN "createdAt" TO "created_at";

-- watch_histories
ALTER TABLE "watch_histories" RENAME COLUMN "tmdbId" TO "tmdb_id";
ALTER TABLE "watch_histories" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "watch_histories" RENAME COLUMN "watchEntryId" TO "watch_entry_id";
ALTER TABLE "watch_histories" RENAME COLUMN "watchedAt" TO "watched_at";
ALTER TABLE "watch_histories" RENAME COLUMN "createdAt" TO "created_at";

-- ratings
ALTER TABLE "ratings" RENAME COLUMN "tmdbId" TO "tmdb_id";
ALTER TABLE "ratings" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "ratings" RENAME COLUMN "ratedAt" TO "rated_at";
ALTER TABLE "ratings" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "ratings" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "ratings" RENAME COLUMN "importedAt" TO "imported_at";

-- comments
ALTER TABLE "comments" RENAME COLUMN "tmdbId" TO "tmdb_id";
ALTER TABLE "comments" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "comments" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "comments" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "comments" RENAME COLUMN "importedAt" TO "imported_at";

-- tv_watch_entries
ALTER TABLE "tv_watch_entries" RENAME COLUMN "seriesTmdbId" TO "series_tmdb_id";
ALTER TABLE "tv_watch_entries" RENAME COLUMN "seasonNumber" TO "season_number";
ALTER TABLE "tv_watch_entries" RENAME COLUMN "episodeNumber" TO "episode_number";
ALTER TABLE "tv_watch_entries" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "tv_watch_entries" RENAME COLUMN "latestWatchedAt" TO "latest_watched_at";
ALTER TABLE "tv_watch_entries" RENAME COLUMN "createdAt" TO "created_at";

-- tv_watch_histories
ALTER TABLE "tv_watch_histories" RENAME COLUMN "seriesTmdbId" TO "series_tmdb_id";
ALTER TABLE "tv_watch_histories" RENAME COLUMN "seasonNumber" TO "season_number";
ALTER TABLE "tv_watch_histories" RENAME COLUMN "episodeNumber" TO "episode_number";
ALTER TABLE "tv_watch_histories" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "tv_watch_histories" RENAME COLUMN "tvWatchEntryId" TO "tv_watch_entry_id";
ALTER TABLE "tv_watch_histories" RENAME COLUMN "watchedAt" TO "watched_at";
ALTER TABLE "tv_watch_histories" RENAME COLUMN "createdAt" TO "created_at";

-- tv_ratings
ALTER TABLE "tv_ratings" RENAME COLUMN "seriesTmdbId" TO "series_tmdb_id";
ALTER TABLE "tv_ratings" RENAME COLUMN "seasonNumber" TO "season_number";
ALTER TABLE "tv_ratings" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "tv_ratings" RENAME COLUMN "ratedAt" TO "rated_at";
ALTER TABLE "tv_ratings" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "tv_ratings" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "tv_ratings" RENAME COLUMN "importedAt" TO "imported_at";

-- tv_reviews
ALTER TABLE "tv_reviews" RENAME COLUMN "seriesTmdbId" TO "series_tmdb_id";
ALTER TABLE "tv_reviews" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "tv_reviews" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "tv_reviews" RENAME COLUMN "updatedAt" TO "updated_at";

-- tv_comments
ALTER TABLE "tv_comments" RENAME COLUMN "seriesTmdbId" TO "series_tmdb_id";
ALTER TABLE "tv_comments" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "tv_comments" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "tv_comments" RENAME COLUMN "updatedAt" TO "updated_at";
ALTER TABLE "tv_comments" RENAME COLUMN "importedAt" TO "imported_at";

-- lists
ALTER TABLE "lists" RENAME COLUMN "creatorId" TO "creator_id";
ALTER TABLE "lists" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "lists" RENAME COLUMN "updatedAt" TO "updated_at";

-- list_items
ALTER TABLE "list_items" RENAME COLUMN "listId" TO "list_id";
ALTER TABLE "list_items" RENAME COLUMN "movieTmdbId" TO "movie_tmdb_id";
ALTER TABLE "list_items" RENAME COLUMN "seriesTmdbId" TO "series_tmdb_id";
ALTER TABLE "list_items" RENAME COLUMN "seasonNumber" TO "season_number";
ALTER TABLE "list_items" RENAME COLUMN "episodeNumber" TO "episode_number";
ALTER TABLE "list_items" RENAME COLUMN "remoteEntryId" TO "remote_entry_id";
ALTER TABLE "list_items" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "list_items" RENAME COLUMN "updatedAt" TO "updated_at";

-- flexget_integrations
ALTER TABLE "flexget_integrations" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "flexget_integrations" RENAME COLUMN "baseUrl" TO "base_url";
ALTER TABLE "flexget_integrations" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "flexget_integrations" RENAME COLUMN "updatedAt" TO "updated_at";

-- list_integrations
ALTER TABLE "list_integrations" RENAME COLUMN "listId" TO "list_id";
ALTER TABLE "list_integrations" RENAME COLUMN "entryListName" TO "entry_list_name";
ALTER TABLE "list_integrations" RENAME COLUMN "remoteListId" TO "remote_list_id";
ALTER TABLE "list_integrations" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "list_integrations" RENAME COLUMN "updatedAt" TO "updated_at";

-- trakt_integrations
ALTER TABLE "trakt_integrations" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "trakt_integrations" RENAME COLUMN "accessToken" TO "access_token";
ALTER TABLE "trakt_integrations" RENAME COLUMN "refreshToken" TO "refresh_token";
ALTER TABLE "trakt_integrations" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "trakt_integrations" RENAME COLUMN "traktUsername" TO "trakt_username";
ALTER TABLE "trakt_integrations" RENAME COLUMN "traktSlug" TO "trakt_slug";
ALTER TABLE "trakt_integrations" RENAME COLUMN "lastSyncedAt" TO "last_synced_at";
ALTER TABLE "trakt_integrations" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "trakt_integrations" RENAME COLUMN "updatedAt" TO "updated_at";

-- plex_integrations
ALTER TABLE "plex_integrations" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "plex_integrations" RENAME COLUMN "webhookToken" TO "webhook_token";
ALTER TABLE "plex_integrations" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "plex_integrations" RENAME COLUMN "updatedAt" TO "updated_at";

-- Rename primary key constraints to match new table names
ALTER TABLE "users" RENAME CONSTRAINT "User_pkey" TO "users_pkey";
ALTER TABLE "reviews" RENAME CONSTRAINT "Review_pkey" TO "reviews_pkey";
ALTER TABLE "watch_entries" RENAME CONSTRAINT "WatchEntry_pkey" TO "watch_entries_pkey";
ALTER TABLE "watch_histories" RENAME CONSTRAINT "WatchHistory_pkey" TO "watch_histories_pkey";
ALTER TABLE "ratings" RENAME CONSTRAINT "Rating_pkey" TO "ratings_pkey";
ALTER TABLE "comments" RENAME CONSTRAINT "Comment_pkey" TO "comments_pkey";
ALTER TABLE "tv_watch_entries" RENAME CONSTRAINT "TvWatchEntry_pkey" TO "tv_watch_entries_pkey";
ALTER TABLE "tv_watch_histories" RENAME CONSTRAINT "TvWatchHistory_pkey" TO "tv_watch_histories_pkey";
ALTER TABLE "tv_ratings" RENAME CONSTRAINT "TvRating_pkey" TO "tv_ratings_pkey";
ALTER TABLE "tv_reviews" RENAME CONSTRAINT "TvReview_pkey" TO "tv_reviews_pkey";
ALTER TABLE "tv_comments" RENAME CONSTRAINT "TvComment_pkey" TO "tv_comments_pkey";
ALTER TABLE "lists" RENAME CONSTRAINT "List_pkey" TO "lists_pkey";
ALTER TABLE "list_items" RENAME CONSTRAINT "ListItem_pkey" TO "list_items_pkey";
ALTER TABLE "flexget_integrations" RENAME CONSTRAINT "FlexgetIntegration_pkey" TO "flexget_integrations_pkey";
ALTER TABLE "list_integrations" RENAME CONSTRAINT "ListIntegration_pkey" TO "list_integrations_pkey";
ALTER TABLE "trakt_integrations" RENAME CONSTRAINT "TraktIntegration_pkey" TO "trakt_integrations_pkey";
ALTER TABLE "plex_integrations" RENAME CONSTRAINT "PlexIntegration_pkey" TO "plex_integrations_pkey";

-- Rename foreign key constraints
ALTER TABLE "reviews" RENAME CONSTRAINT "Review_userId_fkey" TO "reviews_user_id_fkey";
ALTER TABLE "watch_entries" RENAME CONSTRAINT "WatchEntry_userId_fkey" TO "watch_entries_user_id_fkey";
ALTER TABLE "watch_histories" RENAME CONSTRAINT "WatchHistory_userId_fkey" TO "watch_histories_user_id_fkey";
ALTER TABLE "watch_histories" RENAME CONSTRAINT "WatchHistory_watchEntryId_fkey" TO "watch_histories_watch_entry_id_fkey";
ALTER TABLE "ratings" RENAME CONSTRAINT "Rating_userId_fkey" TO "ratings_user_id_fkey";
ALTER TABLE "comments" RENAME CONSTRAINT "Comment_userId_fkey" TO "comments_user_id_fkey";
ALTER TABLE "tv_watch_entries" RENAME CONSTRAINT "TvWatchEntry_userId_fkey" TO "tv_watch_entries_user_id_fkey";
ALTER TABLE "tv_watch_histories" RENAME CONSTRAINT "TvWatchHistory_userId_fkey" TO "tv_watch_histories_user_id_fkey";
ALTER TABLE "tv_watch_histories" RENAME CONSTRAINT "TvWatchHistory_tvWatchEntryId_fkey" TO "tv_watch_histories_tv_watch_entry_id_fkey";
ALTER TABLE "tv_ratings" RENAME CONSTRAINT "TvRating_userId_fkey" TO "tv_ratings_user_id_fkey";
ALTER TABLE "tv_reviews" RENAME CONSTRAINT "TvReview_userId_fkey" TO "tv_reviews_user_id_fkey";
ALTER TABLE "tv_comments" RENAME CONSTRAINT "TvComment_userId_fkey" TO "tv_comments_user_id_fkey";
ALTER TABLE "lists" RENAME CONSTRAINT "List_creatorId_fkey" TO "lists_creator_id_fkey";
ALTER TABLE "list_items" RENAME CONSTRAINT "ListItem_listId_fkey" TO "list_items_list_id_fkey";
ALTER TABLE "flexget_integrations" RENAME CONSTRAINT "FlexgetIntegration_userId_fkey" TO "flexget_integrations_user_id_fkey";
ALTER TABLE "list_integrations" RENAME CONSTRAINT "ListIntegration_listId_fkey" TO "list_integrations_list_id_fkey";
ALTER TABLE "trakt_integrations" RENAME CONSTRAINT "TraktIntegration_userId_fkey" TO "trakt_integrations_user_id_fkey";
ALTER TABLE "plex_integrations" RENAME CONSTRAINT "PlexIntegration_userId_fkey" TO "plex_integrations_user_id_fkey";

-- Rename indexes (unique and non-unique)
ALTER INDEX "User_email_key" RENAME TO "users_email_key";
ALTER INDEX "User_username_key" RENAME TO "users_username_key";
ALTER INDEX "Review_tmdbId_userId_key" RENAME TO "reviews_tmdb_id_user_id_key";
ALTER INDEX "WatchEntry_tmdbId_userId_key" RENAME TO "watch_entries_tmdb_id_user_id_key";
ALTER INDEX "WatchHistory_tmdbId_idx" RENAME TO "watch_histories_tmdb_id_idx";
ALTER INDEX "WatchHistory_userId_idx" RENAME TO "watch_histories_user_id_idx";
ALTER INDEX "WatchHistory_watchEntryId_idx" RENAME TO "watch_histories_watch_entry_id_idx";
ALTER INDEX "Rating_tmdbId_userId_key" RENAME TO "ratings_tmdb_id_user_id_key";
ALTER INDEX "Comment_tmdbId_idx" RENAME TO "comments_tmdb_id_idx";
ALTER INDEX "TvWatchEntry_seriesTmdbId_seasonNumber_episodeNumber_userId_key" RENAME TO "tv_watch_entries_series_tmdb_id_season_number_episode_numbe_key";
ALTER INDEX "TvWatchHistory_seriesTmdbId_idx" RENAME TO "tv_watch_histories_series_tmdb_id_idx";
ALTER INDEX "TvWatchHistory_userId_idx" RENAME TO "tv_watch_histories_user_id_idx";
ALTER INDEX "TvWatchHistory_tvWatchEntryId_idx" RENAME TO "tv_watch_histories_tv_watch_entry_id_idx";
ALTER INDEX "TvRating_seriesTmdbId_seasonNumber_userId_key" RENAME TO "tv_ratings_series_tmdb_id_season_number_user_id_key";
ALTER INDEX "TvReview_seriesTmdbId_userId_key" RENAME TO "tv_reviews_series_tmdb_id_user_id_key";
ALTER INDEX "TvComment_seriesTmdbId_idx" RENAME TO "tv_comments_series_tmdb_id_idx";
ALTER INDEX "FlexgetIntegration_userId_key" RENAME TO "flexget_integrations_user_id_key";
ALTER INDEX "ListIntegration_listId_key" RENAME TO "list_integrations_list_id_key";
ALTER INDEX "TraktIntegration_userId_key" RENAME TO "trakt_integrations_user_id_key";
ALTER INDEX "PlexIntegration_userId_key" RENAME TO "plex_integrations_user_id_key";
ALTER INDEX "PlexIntegration_webhookToken_key" RENAME TO "plex_integrations_webhook_token_key";

-- Rename sequences generated for SERIAL primary keys, to match table renames
ALTER SEQUENCE "User_id_seq" RENAME TO "users_id_seq";
ALTER SEQUENCE "Review_id_seq" RENAME TO "reviews_id_seq";
ALTER SEQUENCE "WatchEntry_id_seq" RENAME TO "watch_entries_id_seq";
ALTER SEQUENCE "WatchHistory_id_seq" RENAME TO "watch_histories_id_seq";
ALTER SEQUENCE "Rating_id_seq" RENAME TO "ratings_id_seq";
ALTER SEQUENCE "Comment_id_seq" RENAME TO "comments_id_seq";
ALTER SEQUENCE "TvWatchEntry_id_seq" RENAME TO "tv_watch_entries_id_seq";
ALTER SEQUENCE "TvWatchHistory_id_seq" RENAME TO "tv_watch_histories_id_seq";
ALTER SEQUENCE "TvRating_id_seq" RENAME TO "tv_ratings_id_seq";
ALTER SEQUENCE "TvReview_id_seq" RENAME TO "tv_reviews_id_seq";
ALTER SEQUENCE "TvComment_id_seq" RENAME TO "tv_comments_id_seq";
ALTER SEQUENCE "List_id_seq" RENAME TO "lists_id_seq";
ALTER SEQUENCE "ListItem_id_seq" RENAME TO "list_items_id_seq";
ALTER SEQUENCE "FlexgetIntegration_id_seq" RENAME TO "flexget_integrations_id_seq";
ALTER SEQUENCE "ListIntegration_id_seq" RENAME TO "list_integrations_id_seq";
ALTER SEQUENCE "TraktIntegration_id_seq" RENAME TO "trakt_integrations_id_seq";
ALTER SEQUENCE "PlexIntegration_id_seq" RENAME TO "plex_integrations_id_seq";
