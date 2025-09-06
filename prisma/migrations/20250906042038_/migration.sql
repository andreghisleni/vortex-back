/*
  Warnings:

  - You are about to drop the `Member` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Member" DROP CONSTRAINT "Member_event_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."Member" DROP CONSTRAINT "Member_session_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."payments" DROP CONSTRAINT "payments_member_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."ticket_ranges" DROP CONSTRAINT "ticket_ranges_member_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."tickets" DROP CONSTRAINT "tickets_member_id_fkey";

-- DropTable
DROP TABLE "public"."Member";

-- CreateTable
CREATE TABLE "public"."members" (
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

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."members" ADD CONSTRAINT "members_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."members" ADD CONSTRAINT "members_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."scout_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_ranges" ADD CONSTRAINT "ticket_ranges_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
