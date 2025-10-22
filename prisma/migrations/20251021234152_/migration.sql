-- AlterTable
ALTER TABLE "public"."tickets" ADD COLUMN     "allocation_id" TEXT;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "public"."member_ticket_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
