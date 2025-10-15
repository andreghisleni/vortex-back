-- CreateTable
CREATE TABLE "public"."member_ticket_allocations" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "event_ticket_range_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_ticket_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_ticket_allocations_member_id_event_ticket_range_id_key" ON "public"."member_ticket_allocations"("member_id", "event_ticket_range_id");

-- AddForeignKey
ALTER TABLE "public"."member_ticket_allocations" ADD CONSTRAINT "member_ticket_allocations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."member_ticket_allocations" ADD CONSTRAINT "member_ticket_allocations_event_ticket_range_id_fkey" FOREIGN KEY ("event_ticket_range_id") REFERENCES "public"."event_ticket_ranges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
