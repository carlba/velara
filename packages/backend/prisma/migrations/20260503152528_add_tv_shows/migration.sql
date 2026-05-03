-- CreateTable
CREATE TABLE "TvWatchEntry" (
    "id" SERIAL NOT NULL,
    "seriesTmdbId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "watchedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TvWatchEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TvRating" (
    "id" SERIAL NOT NULL,
    "seriesTmdbId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL DEFAULT 0,
    "userId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "ratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3),

    CONSTRAINT "TvRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TvReview" (
    "id" SERIAL NOT NULL,
    "seriesTmdbId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TvReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TvComment" (
    "id" SERIAL NOT NULL,
    "seriesTmdbId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3),

    CONSTRAINT "TvComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TvWatchEntry_seriesTmdbId_seasonNumber_episodeNumber_userId_key" ON "TvWatchEntry"("seriesTmdbId", "seasonNumber", "episodeNumber", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TvRating_seriesTmdbId_seasonNumber_userId_key" ON "TvRating"("seriesTmdbId", "seasonNumber", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TvReview_seriesTmdbId_userId_key" ON "TvReview"("seriesTmdbId", "userId");

-- CreateIndex
CREATE INDEX "TvComment_seriesTmdbId_idx" ON "TvComment"("seriesTmdbId");

-- AddForeignKey
ALTER TABLE "TvWatchEntry" ADD CONSTRAINT "TvWatchEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TvRating" ADD CONSTRAINT "TvRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TvReview" ADD CONSTRAINT "TvReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TvComment" ADD CONSTRAINT "TvComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
