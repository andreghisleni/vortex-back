-- CreateTable
CREATE TABLE "public"."event_ticket_ranges" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "start" INTEGER NOT NULL,
    "end" INTEGER NOT NULL,
    "event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "event_ticket_ranges_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."event_ticket_ranges" ADD CONSTRAINT "event_ticket_ranges_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
