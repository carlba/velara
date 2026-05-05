/*
Warnings:

- You are about to drop the column `watchedAt` on the `TvWatchEntry` table. All the data in the column will be lost.
- You are about to drop the column `watchedAt` on the `WatchEntry` table. All the data in the column will be lost.
- Added the required column `latestWatchedAt` to the `TvWatchEntry` table without a default value. This is not possible if the table is not empty.
- Added the required column `latestWatchedAt` to the `WatchEntry` table without a default value. This is not possible if the table is not empty.

 */
-- AlterTable
ALTER TABLE "TvWatchEntry"
ADD COLUMN "latestWatchedAt" TIMESTAMP(3);

UPDATE "TvWatchEntry"
SET
    "latestWatchedAt" = "watchedAt";

ALTER TABLE "TvWatchEntry"
ALTER COLUMN "latestWatchedAt"
SET
    NOT NULL;

ALTER TABLE "TvWatchEntry"
DROP COLUMN "watchedAt";

-- AlterTable
ALTER TABLE "WatchEntry"
ADD COLUMN "latestWatchedAt" TIMESTAMP(3);

UPDATE "WatchEntry"
SET
    "latestWatchedAt" = "watchedAt";

ALTER TABLE "WatchEntry"
ALTER COLUMN "latestWatchedAt"
SET
    NOT NULL;

ALTER TABLE "WatchEntry"
DROP COLUMN "watchedAt";

-- CreateTable
CREATE TABLE
    "WatchHistory" (
        "id" SERIAL NOT NULL,
        "tmdbId" INTEGER NOT NULL,
        "userId" INTEGER NOT NULL,
        "watchedAt" TIMESTAMP(3) NOT NULL,
        "source" TEXT NOT NULL DEFAULT 'manual',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "WatchHistory_pkey" PRIMARY KEY ("id")
    );

-- CreateTable
CREATE TABLE
    "TvWatchHistory" (
        "id" SERIAL NOT NULL,
        "seriesTmdbId" TEXT NOT NULL,
        "seasonNumber" INTEGER NOT NULL,
        "episodeNumber" INTEGER NOT NULL,
        "userId" INTEGER NOT NULL,
        "watchedAt" TIMESTAMP(3) NOT NULL,
        "source" TEXT NOT NULL DEFAULT 'manual',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TvWatchHistory_pkey" PRIMARY KEY ("id")
    );

-- CreateIndex
CREATE INDEX "WatchHistory_tmdbId_idx" ON "WatchHistory" ("tmdbId");

-- CreateIndex
CREATE INDEX "WatchHistory_userId_idx" ON "WatchHistory" ("userId");

-- CreateIndex
CREATE INDEX "TvWatchHistory_seriesTmdbId_idx" ON "TvWatchHistory" ("seriesTmdbId");

-- CreateIndex
CREATE INDEX "TvWatchHistory_userId_idx" ON "TvWatchHistory" ("userId");

-- AddForeignKey
ALTER TABLE "WatchHistory" ADD CONSTRAINT "WatchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TvWatchHistory" ADD CONSTRAINT "TvWatchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
