-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'blocked');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "birthdate" TEXT,
    "photoUrl" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "field" TEXT,
    "before" TEXT,
    "after" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preference" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "priorities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "morning" TEXT,
    "night" TEXT,
    "sunday" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "notifOn" BOOLEAN NOT NULL DEFAULT true,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "endTime" TEXT,
    "place" TEXT,
    "notes" TEXT,
    "participantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "date" TEXT,
    "time" TEXT,
    "priority" TEXT,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TEXT,
    "goalId" TEXT,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'count',
    "targetValue" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "startDate" TEXT NOT NULL,
    "deadline" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalStep" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "deadline" TEXT,
    "doneAt" TEXT,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GoalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalHistory" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "GoalHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'Diário',
    "objective" TEXT,
    "durationTarget" INTEGER,
    "startDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitLog" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT true,
    "duration" INTEGER,
    "note" TEXT,
    "mood" TEXT,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "HabitLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceNote" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "goalId" TEXT,
    "receiptFileId" TEXT,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FinanceNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileItem" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "docDate" TEXT,
    "description" TEXT,
    "category" TEXT,
    "storageKey" TEXT,
    "privacy" TEXT NOT NULL DEFAULT 'private',
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FileItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT,
    "summary" TEXT,
    "mood" TEXT,
    "audioKey" TEXT,
    "photoKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "personIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dream" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TEXT NOT NULL,
    "goalId" TEXT,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Dream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "date" TEXT NOT NULL,
    "category" TEXT,
    "goalId" TEXT,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportantPerson" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "relation" TEXT,
    "birthday" TEXT,
    "phone" TEXT,
    "howMet" TEXT,
    "notes" TEXT,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ImportantPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dependent" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthdate" TEXT,
    "guardianIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Dependent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "message" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "audioKey" TEXT,
    "confirmed" BOOLEAN,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Retrospective" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT,
    "data" JSONB,
    "rev" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Retrospective_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Share_recipientId_status_idx" ON "Share"("recipientId", "status");

-- CreateIndex
CREATE INDEX "Share_entityType_entityId_idx" ON "Share"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Share_ownerId_recipientId_entityType_entityId_key" ON "Share"("ownerId", "recipientId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ChangeLog_ownerId_createdAt_idx" ON "ChangeLog"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "ChangeLog_entityType_entityId_idx" ON "ChangeLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Preference_ownerId_key" ON "Preference"("ownerId");

-- CreateIndex
CREATE INDEX "Preference_ownerId_rev_idx" ON "Preference"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "Appointment_ownerId_rev_idx" ON "Appointment"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "Task_ownerId_rev_idx" ON "Task"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "Goal_ownerId_rev_idx" ON "Goal"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "GoalStep_ownerId_rev_idx" ON "GoalStep"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "GoalStep_goalId_idx" ON "GoalStep"("goalId");

-- CreateIndex
CREATE INDEX "GoalHistory_ownerId_rev_idx" ON "GoalHistory"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "GoalHistory_goalId_idx" ON "GoalHistory"("goalId");

-- CreateIndex
CREATE INDEX "Habit_ownerId_rev_idx" ON "Habit"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "HabitLog_ownerId_rev_idx" ON "HabitLog"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "HabitLog_habitId_idx" ON "HabitLog"("habitId");

-- CreateIndex
CREATE INDEX "FinanceNote_ownerId_rev_idx" ON "FinanceNote"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "FileItem_ownerId_rev_idx" ON "FileItem"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "DiaryEntry_ownerId_rev_idx" ON "DiaryEntry"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "Dream_ownerId_rev_idx" ON "Dream"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "Idea_ownerId_rev_idx" ON "Idea"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "ImportantPerson_ownerId_rev_idx" ON "ImportantPerson"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "Dependent_ownerId_rev_idx" ON "Dependent"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "Notification_ownerId_rev_idx" ON "Notification"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "AiMessage_ownerId_rev_idx" ON "AiMessage"("ownerId", "rev");

-- CreateIndex
CREATE INDEX "Retrospective_ownerId_rev_idx" ON "Retrospective"("ownerId", "rev");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
