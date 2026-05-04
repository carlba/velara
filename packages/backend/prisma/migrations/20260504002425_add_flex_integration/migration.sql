-- CreateTable
CREATE TABLE "FlexgetIntegration" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlexgetIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListIntegration" (
    "id" SERIAL NOT NULL,
    "listId" INTEGER NOT NULL,
    "entryListName" TEXT NOT NULL,
    "remoteListId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlexgetIntegration_userId_key" ON "FlexgetIntegration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ListIntegration_listId_key" ON "ListIntegration"("listId");

-- AddForeignKey
ALTER TABLE "FlexgetIntegration" ADD CONSTRAINT "FlexgetIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListIntegration" ADD CONSTRAINT "ListIntegration_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;
