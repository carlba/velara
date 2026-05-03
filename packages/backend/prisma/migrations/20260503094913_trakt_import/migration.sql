-- AlterTable
ALTER TABLE "Rating" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "WatchEntry" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'manual';
