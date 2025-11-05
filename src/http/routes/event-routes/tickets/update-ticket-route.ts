import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

// Schema para o enum TicketCreated
const ticketCreatedSchema = t.Union([
  t.Literal("ONTHELOT"),
  t.Literal("AFTERIMPORT"),
]);

// Schema para o corpo da requisição
const ticketBodySchema = t.Object(
  {
    // number: t.Number(),
    // memberId: t.Optional(t.String({ format: 'uuid' })),
    name: t.Optional(t.String()),
    phone: t.Optional(t.String()),
    description: t.Optional(t.String()),
    deliveredAt: t.Optional(t.Date()),
    returned: t.Optional(t.Boolean()),
    created: t.Optional(ticketCreatedSchema),
    ticketRangeId: t.Optional(t.String({ format: "uuid" })),
  },
  {
    description: "Schema for updating a ticket",
  }
);

// Schema para os parâmetros que incluem eventId e id
const ticketParamsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
    id: t.String({ format: "uuid" }),
  },
  {
    description: "Parameters including eventId and ticket id",
  }
);

export const updateTicketRoute = new Elysia().macro(authMacro).put(
  "/:id",
  async ({ params, body, set }) => {
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
    try {
      // Verifica se o ticket pertence ao evento correto antes de atualizar
      const existingTicket = await prisma.ticket.findUnique({
        where: { id: params.id },
      });

      if (!existingTicket || existingTicket.eventId !== params.eventId) {
        set.status = 404;
        return { error: "Ticket not found in this event" };
      }

      await prisma.ticket.update({
        where: { id: params.id },
        data: body,
        include: {
          member: {
            include: {
              session: true,
            },
          },
        },
      });
      set.status = 201;
    } catch {
      set.status = 404;
      return { error: "Ticket not found in this event" };
    }
  },
  {
    auth: true,
    params: ticketParamsSchema,
    body: t.Partial(ticketBodySchema),
    response: {
      201: t.Void({
        description: "Ticket updated successfully",
      }),
      404: t.Object(
        {
          error: t.String({
            description: "Error message",
          }),
        },
        {
          description: "Ticket not found",
        }
      ),
    },
    detail: {
      summary: "Update a ticket by ID for a specific event",
      operationId: "updateEventTicketById",
    },
  }
);
