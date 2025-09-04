-- DropForeignKey
ALTER TABLE "public"."events" DROP CONSTRAINT "events_ownerId_fkey";

-- AlterTable
ALTER TABLE "public"."events" ALTER COLUMN "ownerId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
