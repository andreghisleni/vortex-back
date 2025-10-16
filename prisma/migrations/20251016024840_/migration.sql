-- DropForeignKey
ALTER TABLE "public"."tickets" DROP CONSTRAINT "tickets_ticket_range_id_fkey";

-- AlterTable
ALTER TABLE "public"."tickets" ADD COLUMN     "o_ticket_range_id" TEXT;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_o_ticket_range_id_fkey" FOREIGN KEY ("o_ticket_range_id") REFERENCES "public"."ticket_ranges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_ticket_range_id_fkey" FOREIGN KEY ("ticket_range_id") REFERENCES "public"."event_ticket_ranges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
