import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";
import { eventSchema } from "./schemas";

export const getEventsRoute = new Elysia().macro(authMacro).get(
  "/",
  async () => {
    const e = await prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        ticketRanges: true,
      },
    });

    return e;
  },
  {
    auth: true,
    detail: {
      tags: ["Events"],
      summary: "Get all events",
      operationId: "getAllEvents",
    },
    response: {
      200: t.Array(eventSchema, { description: "List of all events" }),
    },
  }
);
