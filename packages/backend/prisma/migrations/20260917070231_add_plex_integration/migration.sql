-- CreateTable
CREATE TABLE "PlexIntegration" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "webhookToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlexIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlexIntegration_userId_key" ON "PlexIntegration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlexIntegration_webhookToken_key" ON "PlexIntegration"("webhookToken");

-- AddForeignKey
ALTER TABLE "PlexIntegration" ADD CONSTRAINT "PlexIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
