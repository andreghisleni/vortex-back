import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";
import { sessionTypeSchema } from "../../scout-sessions";

// Schema para o enum TicketCreated
const ticketCreatedSchema = t.Union([
  t.Literal("ONTHELOT"),
  t.Literal("AFTERIMPORT"),
]);

// Schema para o modelo Ticket
const ticketSchema = t.Object(
  {
    id: t.String({ format: "uuid" }),
    number: t.Number(),
    memberId: t.Nullable(t.String({ format: "uuid" })),
    member: t.Nullable(
      t.Object(
        {
          id: t.String({ format: "uuid" }),
          eventId: t.String({ format: "uuid" }),
          order: t.Nullable(t.Number()),
          visionId: t.Nullable(t.String()),
          name: t.String(),
          cleanName: t.String(),
          register: t.Nullable(t.String()),
          isAllConfirmedButNotYetFullyPaid: t.Boolean(),
          session: t.Object({
            id: t.String({
              format: "uuid",
              description: "Unique identifier for the scout session",
            }),
            name: t.String({
              description: "Name of the scout session",
              minLength: 3,
            }),
            type: sessionTypeSchema,
            createdAt: t.Date({
              description: "Timestamp when the session was created",
            }),
            updatedAt: t.Date({
              description: "Timestamp when the session was last updated",
            }),
          }),
          createdAt: t.Date(),
        },
        {
          description: "Member associated with the ticket",
        }
      )
    ),
    name: t.Nullable(t.String()),
    phone: t.Nullable(t.String()),
    description: t.Nullable(t.String()),
    deliveredAt: t.Nullable(t.Date()),
    returned: t.Boolean(),
    createdAt: t.Date(),
    created: ticketCreatedSchema,
    eventId: t.String({ format: "uuid" }),
    ticketRangeId: t.Nullable(t.String({ format: "uuid" })),
  },
  {
    description: "Schema for the Ticket model",
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

export const getTicketRoute = new Elysia().macro(authMacro).get(
  "/:id",
  async ({ params, set }) => {
    const ticket = await prisma.ticket.findUnique({
      where: { id: params.id },
      include: {
        member: {
          include: {
            session: true,
          },
        },
      },
    });

    if (!ticket || ticket.eventId !== params.eventId) {
      set.status = 404;
      return { error: "Ticket not found in this event" };
    }

    return ticket;
  },
  {
    params: ticketParamsSchema,
    response: {
      200: ticketSchema,
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
      summary: "Get a ticket by ID for a specific event",
      operationId: "getEventTicketById",
    },
  }
);
