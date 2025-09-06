-- CreateEnum
CREATE TYPE "public"."SessionType" AS ENUM ('LOBINHO', 'ESCOTEIRO', 'SENIOR', 'PIONEIRO', 'OUTRO');

-- CreateEnum
CREATE TYPE "public"."TicketCreated" AS ENUM ('ONTHELOT', 'AFTERIMPORT');

-- CreateEnum
CREATE TYPE "public"."PaymentType" AS ENUM ('CASH', 'PIX');

-- CreateTable
CREATE TABLE "public"."scout_sessions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."SessionType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Member" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "order" INTEGER,
    "vision_id" TEXT,
    "name" TEXT NOT NULL,
    "clean_name" TEXT NOT NULL,
    "register" TEXT,
    "is_all_confirmed_but_not_yet_fully_paid" BOOLEAN NOT NULL DEFAULT false,
    "session_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ticket_ranges" (
    "id" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "member_id" TEXT,
    "generated_at" TIMESTAMP(3),
    "event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ticket_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tickets" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "member_id" TEXT,
    "name" TEXT,
    "phone" TEXT,
    "description" TEXT,
    "delivered_at" TIMESTAMP(3),
    "returned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created" "public"."TicketCreated" NOT NULL DEFAULT 'ONTHELOT',
    "event_id" TEXT NOT NULL,
    "ticket_range_id" TEXT,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "vision_id" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "public"."PaymentType" NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "member_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scout_sessions_name_key" ON "public"."scout_sessions"("name");

-- AddForeignKey
ALTER TABLE "public"."Member" ADD CONSTRAINT "Member_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Member" ADD CONSTRAINT "Member_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."scout_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_ranges" ADD CONSTRAINT "ticket_ranges_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_ranges" ADD CONSTRAINT "ticket_ranges_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_ticket_range_id_fkey" FOREIGN KEY ("ticket_range_id") REFERENCES "public"."ticket_ranges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
