-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentTeamId" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_currentTeamId_fkey" FOREIGN KEY ("currentTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
