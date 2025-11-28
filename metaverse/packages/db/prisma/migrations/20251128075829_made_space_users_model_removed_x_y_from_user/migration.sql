/*
  Warnings:

  - You are about to drop the column `x` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `y` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "x",
DROP COLUMN "y";

-- CreateTable
CREATE TABLE "spaceUsers" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,

    CONSTRAINT "spaceUsers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spaceUsers_id_key" ON "spaceUsers"("id");

-- AddForeignKey
ALTER TABLE "spaceUsers" ADD CONSTRAINT "spaceUsers_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spaceUsers" ADD CONSTRAINT "spaceUsers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
