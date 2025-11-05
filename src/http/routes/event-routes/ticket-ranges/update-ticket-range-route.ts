import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

// Schema para o corpo da requisição
const ticketRangeBodySchema = t.Object(
  {
    start: t.Number(),
    end: t.Number(),
    memberId: t.Optional(t.String({ format: "uuid" })),
  },
  {
    description: "Schema for updating a ticket range",
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

export const updateTicketRangeRoute = new Elysia().macro(authMacro).put(
  "/:id",
  async ({ params, body, set }) => {
    try {
      // Verifica se o evento existe e se não está em modo somente leitura
      const event = await prisma.event.findUnique({
        where: { id: params.eventId },
      });
      if (!event) {
        set.status = 404;
        return { error: "Event not found" };
      }

      if (event.readOnly) {
        set.status = 403;
        return { error: "Event is read-only" };
      }

      // Verifica se o ticket range pertence ao evento correto antes de atualizar
      const existingRange = await prisma.ticketRange.findUnique({
        where: { id: params.id },
      });

      if (
        !existingRange ||
        existingRange.eventId !== params.eventId ||
        existingRange.deletedAt
      ) {
        set.status = 404;
        return { error: "Ticket range not found in this event" };
      }

      await prisma.ticketRange.update({
        where: { id: params.id, eventId: params.eventId },
        data: body,
      });
      set.status = 201;
    } catch {
      set.status = 404;
      return { error: "Ticket range not found in this event" };
    }
  },
  {
    auth: true,
    params: ticketRangeParamsSchema,
    body: t.Partial(ticketRangeBodySchema),
    response: {
      201: t.Void({
        description: "Ticket range updated successfully",
      }),
      404: t.Object(
        {
          error: t.String({
            description: "Error message",
          }),
        },
        {
          description: "Ticket range or Event not found",
        }
      ),
    },
    detail: {
      summary: "Update a ticket range by ID for a specific event",
      operationId: "updateEventTicketRangeById",
    },
  }
);
