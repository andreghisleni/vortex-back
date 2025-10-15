-- CreateEnum
CREATE TYPE "public"."TicketFlowType" AS ENUM ('CREATED', 'ASSIGNED', 'DETACHED', 'RETURNED', 'SOLD', 'CHECKED_IN');

-- AlterTable
ALTER TABLE "public"."events" ADD COLUMN     "auto_generate_tickets_total_per_member" INTEGER,
ADD COLUMN     "read_only" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."ticket_flows" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT,
    "event_id" TEXT NOT NULL,
    "type" "public"."TicketFlowType" NOT NULL,
    "from_member_id" TEXT,
    "to_member_id" TEXT,
    "performed_by" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_flows_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."ticket_flows" ADD CONSTRAINT "ticket_flows_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_flows" ADD CONSTRAINT "ticket_flows_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ticket_flows" ADD CONSTRAINT "ticket_flows_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
