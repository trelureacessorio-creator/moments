-- CreateTable
CREATE TABLE "FileBlob" (
    "id" TEXT NOT NULL,
    "fileItemId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileBlob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileBlob_fileItemId_key" ON "FileBlob"("fileItemId");

-- CreateIndex
CREATE INDEX "FileBlob_ownerId_idx" ON "FileBlob"("ownerId");

