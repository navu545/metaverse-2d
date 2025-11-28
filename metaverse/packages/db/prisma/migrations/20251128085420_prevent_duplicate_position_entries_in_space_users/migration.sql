/*
  Warnings:

  - A unique constraint covering the columns `[userId,spaceId]` on the table `spaceUsers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "spaceUsers_userId_spaceId_key" ON "spaceUsers"("userId", "spaceId");
