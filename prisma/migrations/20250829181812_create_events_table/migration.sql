-- CreateEnum
CREATE TYPE "public"."EventTicketType" AS ENUM ('SINGLE_NUMERATION', 'MULTIPLE_NUMERATIONS');

-- CreateTable
CREATE TABLE "public"."events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ticketType" "public"."EventTicketType" NOT NULL DEFAULT 'SINGLE_NUMERATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);
