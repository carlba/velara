-- Add nullable relation keys first so we can backfill existing rows.
ALTER TABLE "WatchHistory"
ADD COLUMN "watchEntryId" INTEGER;

ALTER TABLE "TvWatchHistory"
ADD COLUMN "tvWatchEntryId" INTEGER;

-- Create missing WatchEntry rows for history records that do not yet have a parent.
WITH
  latest_history AS (
    SELECT DISTINCT
      ON ("tmdbId", "userId") "tmdbId",
      "userId",
      "watchedAt",
      "source"
    FROM
      "WatchHistory"
    ORDER BY
      "tmdbId",
      "userId",
      "watchedAt" DESC,
      "id" DESC
  )
INSERT INTO
  "WatchEntry" ("tmdbId", "userId", "latestWatchedAt", "source")
SELECT
  lh."tmdbId",
  lh."userId",
  lh."watchedAt",
  lh."source"
FROM
  latest_history lh
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      "WatchEntry" we
    WHERE
      we."tmdbId" = lh."tmdbId"
      AND we."userId" = lh."userId"
  );

WITH
  latest_history AS (
    SELECT DISTINCT
      ON (
        "seriesTmdbId",
        "seasonNumber",
        "episodeNumber",
        "userId"
      ) "seriesTmdbId",
      "seasonNumber",
      "episodeNumber",
      "userId",
      "watchedAt",
      "source"
    FROM
      "TvWatchHistory"
    ORDER BY
      "seriesTmdbId",
      "seasonNumber",
      "episodeNumber",
      "userId",
      "watchedAt" DESC,
      "id" DESC
  )
INSERT INTO
  "TvWatchEntry" (
    "seriesTmdbId",
    "seasonNumber",
    "episodeNumber",
    "userId",
    "latestWatchedAt",
    "source"
  )
SELECT
  lh."seriesTmdbId",
  lh."seasonNumber",
  lh."episodeNumber",
  lh."userId",
  lh."watchedAt",
  lh."source"
FROM
  latest_history lh
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      "TvWatchEntry" we
    WHERE
      we."seriesTmdbId" = lh."seriesTmdbId"
      AND we."seasonNumber" = lh."seasonNumber"
      AND we."episodeNumber" = lh."episodeNumber"
      AND we."userId" = lh."userId"
  );

-- Attach all WatchHistory rows to their parent WatchEntry.
UPDATE "WatchHistory" h
SET
  "watchEntryId" = w."id"
FROM
  "WatchEntry" w
WHERE
  h."tmdbId" = w."tmdbId"
  AND h."userId" = w."userId";

-- Attach all TvWatchHistory rows to their parent TvWatchEntry.
UPDATE "TvWatchHistory" h
SET
  "tvWatchEntryId" = w."id"
FROM
  "TvWatchEntry" w
WHERE
  h."seriesTmdbId" = w."seriesTmdbId"
  AND h."seasonNumber" = w."seasonNumber"
  AND h."episodeNumber" = w."episodeNumber"
  AND h."userId" = w."userId";

-- Add indexes for the new relation columns.
CREATE INDEX "WatchHistory_watchEntryId_idx" ON "WatchHistory" ("watchEntryId");

CREATE INDEX "TvWatchHistory_tvWatchEntryId_idx" ON "TvWatchHistory" ("tvWatchEntryId");

-- Enforce the relation.
ALTER TABLE "WatchHistory"
ALTER COLUMN "watchEntryId"
SET
  NOT NULL;

ALTER TABLE "TvWatchHistory"
ALTER COLUMN "tvWatchEntryId"
SET
  NOT NULL;

ALTER TABLE "WatchHistory" ADD CONSTRAINT "WatchHistory_watchEntryId_fkey" FOREIGN KEY ("watchEntryId") REFERENCES "WatchEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TvWatchHistory" ADD CONSTRAINT "TvWatchHistory_tvWatchEntryId_fkey" FOREIGN KEY ("tvWatchEntryId") REFERENCES "TvWatchEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
