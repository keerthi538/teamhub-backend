-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "yjsState" BYTEA;

-- CreateIndex
CREATE INDEX "Document_authorId_idx" ON "Document"("authorId");
