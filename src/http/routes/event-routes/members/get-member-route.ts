import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";
import { sessionTypeSchema } from "../../scout-sessions";
import { paymentTypeSchema } from "../payments/get-payment-route";

export const orderTypeSchema = t.Union([t.Literal("asc"), t.Literal("desc")], {
  description: "Type of the order",
});

// Schema do modelo Member (sem alterações)
const memberSchema = t.Object(
  {
    id: t.String({ format: "uuid" }),
    eventId: t.String({ format: "uuid" }),
    order: t.Nullable(t.Number()),
    visionId: t.Nullable(t.String()),
    name: t.String(),
    cleanName: t.String(),
    register: t.Nullable(t.String()),
    isAllConfirmedButNotYetFullyPaid: t.Boolean(),
    session: t.Object(
      {
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
      },
      {
        description: "Scout session associated with the member",
      }
    ),
    createdAt: t.Date(),
    tickets: t.Array(
      t.Object(
        {
          id: t.String({ format: "uuid" }),
          number: t.Number(),
          memberId: t.Nullable(t.String({ format: "uuid" })),
          name: t.Nullable(t.String()),
          phone: t.Nullable(t.String()),
          description: t.Nullable(t.String()),
          deliveredAt: t.Nullable(t.Date()),
          returned: t.Boolean(),
          createdAt: t.Date(),
          created: t.Union([t.Literal("ONTHELOT"), t.Literal("AFTERIMPORT")]),
          eventId: t.String({ format: "uuid" }),
          ticketRangeId: t.Nullable(t.String({ format: "uuid" })),
        },
        {
          description: "Ticket details associated with the member",
        }
      )
    ),
    payments: t.Array(
      t.Object(
        {
          id: t.String({ format: "uuid" }),
          visionId: t.Nullable(t.String()),
          amount: t.Number(),
          type: paymentTypeSchema,
          payedAt: t.Date(),
          memberId: t.String({ format: "uuid" }),
          createdAt: t.Date(),
          updatedAt: t.Date(),
          deletedAt: t.Nullable(t.Date()),
          deletedBy: t.Nullable(t.String()),
        },
        {
          description: "Payment details associated with the member",
        }
      )
    ),
  },
  {
    description: "Schema for a member",
  }
);

const memberParamsSchema = t.Object({
  eventId: t.String({ format: "uuid" }),
  id: t.String({ format: "uuid" }),
});

export const getMemberRoute = new Elysia().macro(authMacro).get(
  "/:id",
  async ({ params, set }) => {
    // Buscamos o membro garantindo que ele pertence ao evento correto
    const member = await prisma.member.findUnique({
      where: {
        id: params.id,
        eventId: params.eventId, // Garante segurança e escopo correto
      },
      include: {
        session: true,
        tickets: true,
        payments: {
          where: {
            deletedAt: null, // Exclui pagamentos deletados
          },
        },
      },
    });

    if (!member) {
      set.status = 404;
      return { error: "Member not found in this event" };
    }

    set.headers["content-type"] = "application/json";
    return member;
  },
  {
    params: memberParamsSchema,
    response: {
      200: memberSchema,
      404: t.Object(
        {
          error: t.String({
            description: "Error message",
          }),
        },
        { description: "Member not found" }
      ),
    },
    detail: {
      summary: "Get a member by ID for a specific event",
      operationId: "getEventMemberById",
    },
  }
);
