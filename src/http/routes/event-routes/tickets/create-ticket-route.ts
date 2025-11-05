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
    number: t.Number(),
    memberId: t.Optional(t.String({ format: "uuid" })),
    name: t.Optional(t.String()),
    phone: t.Optional(t.String()),
    description: t.Optional(t.String()),
    deliveredAt: t.Optional(t.Date()),
    returned: t.Optional(t.Boolean()),
    created: t.Optional(ticketCreatedSchema),
    ticketRangeId: t.Optional(t.String({ format: "uuid" })),
  },
  {
    description: "Schema for creating a ticket",
  }
);

// Schema para os parâmetros que incluem eventId
const eventParamsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
  },
  {
    description: "Parameters including eventId",
  }
);

export const createTicketRoute = new Elysia().macro(authMacro).post(
  "/",
  async ({ body, params, set }) => {
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
    // Verifica se o ticket number já existe para o evento
    const existingTicket = await prisma.ticket.findFirst({
      where: {
        eventId: params.eventId,
        number: body.number,
      },
    });

    if (existingTicket) {
      set.status = 400;
      return { error: "Ticket number already exists for this event" };
    }

    // check member exists and belongs to event
    if (body.memberId) {
      const member = await prisma.member.findUnique({
        where: { id: body.memberId },
      });

      if (!member || member.eventId !== params.eventId) {
        set.status = 400;
        return { error: "Member does not belong to the specified event" };
      }
    }
    await prisma.ticket.create({
      data: {
        ...body,
        eventId: params.eventId,
      },
    });

    set.status = 201;
  },
  {
    auth: true,
    params: eventParamsSchema,
    body: ticketBodySchema,
    response: {
      201: t.Void({
        description: "Ticket created successfully",
      }),
      400: t.Object(
        {
          error: t.String({
            description: "Error message",
          }),
        },
        {
          description: "Bad request",
        }
      ),
    },
    detail: {
      summary: "Create a new ticket for a specific event",
      operationId: "createEventTicket",
    },
  }
);
