import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

// Schema para o modelo TicketRange
const ticketRangeSchema = t.Object(
  {
    id: t.String({ format: "uuid" }),
    start: t.Number(),
    end: t.Number(),
    memberId: t.Nullable(t.String({ format: "uuid" })),
    generatedAt: t.Nullable(t.Date()),
    eventId: t.String({ format: "uuid" }),
    createdAt: t.Date(),
    deletedAt: t.Nullable(t.Date()),
  },
  {
    description: "Schema for a ticket range",
  }
);

// Schema para os parâmetros que incluem eventId e id
const ticketRangeParamsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
    id: t.String({ format: "uuid" }),
  },
  {
    description: "Schema for ticket range parameters including eventId and id",
  }
);

export const getTicketRangeRoute = new Elysia().macro(authMacro).get(
  "/:id",
  async ({ params, set }) => {
    const range = await prisma.ticketRange.findUnique({
      where: { id: params.id },
    });

    if (!range || range.deletedAt || range.eventId !== params.eventId) {
      set.status = 404;
      return { error: "Ticket range not found in this event" };
    }

    return range;
  },
  {
    params: ticketRangeParamsSchema,
    response: {
      200: ticketRangeSchema,
      404: t.Object(
        {
          error: t.String({
            description: "Error message",
          }),
        },
        {
          description: "Ticket range not found in this event",
        }
      ),
    },
    detail: {
      summary: "Get a ticket range by ID for a specific event",
      operationId: "getEventTicketRangeById",
    },
  }
);
