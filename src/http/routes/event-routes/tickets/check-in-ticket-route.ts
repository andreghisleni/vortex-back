import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

const paramsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
  },
  {
    description: "Parameters including eventId",
  }
);

const bodySchema = t.Object(
  {
    ticketNumber: t.Number({
      description: "Ticket number from barcode scanner",
    }),
  },
  {
    description: "Body containing the ticket number to check-in",
  }
);

const ticketResponseSchema = t.Object({
  id: t.String({ format: "uuid" }),
  number: t.Number(),
  name: t.Nullable(t.String()),
  phone: t.Nullable(t.String()),
  description: t.Nullable(t.String()),
  deliveredAt: t.Nullable(t.Date()),
  alreadyCheckedIn: t.Boolean(),
  member: t.Nullable(
    t.Object({
      id: t.String({ format: "uuid" }),
      name: t.String(),
      session: t.Object({
        id: t.String({ format: "uuid" }),
        name: t.String(),
      }),
    })
  ),
});

export const checkInTicketRoute = new Elysia().macro(authMacro).post(
  "/check-in",
  async ({ params, body, set, user }) => {
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

    // Busca o ticket pelo número no evento
    const ticket = await prisma.ticket.findFirst({
      where: {
        eventId: params.eventId,
        number: body.ticketNumber,
      },
      include: {
        member: {
          include: {
            session: true,
          },
        },
      },
    });

    if (!ticket) {
      set.status = 404;
      return { error: "Ticket not found" };
    }

    // Verifica se já foi feito check-in
    const alreadyCheckedIn = ticket.deliveredAt !== null;

    if (alreadyCheckedIn) {
      // Retorna informações do ticket mas indica que já foi usado
      return {
        id: ticket.id,
        number: ticket.number,
        name: ticket.name,
        phone: ticket.phone,
        description: ticket.description,
        deliveredAt: ticket.deliveredAt,
        alreadyCheckedIn: true,
        member: ticket.member
          ? {
              id: ticket.member.id,
              name: ticket.member.name,
              session: {
                id: ticket.member.session.id,
                name: ticket.member.session.name,
              },
            }
          : null,
      };
    }

    // Faz o check-in
    const now = new Date();

    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { deliveredAt: now },
      }),
      prisma.ticketFlow.create({
        data: {
          ticketId: ticket.id,
          eventId: params.eventId,
          type: "CHECKED_IN",
          performedBy: user?.id ?? null,
        },
      }),
    ]);

    return {
      id: ticket.id,
      number: ticket.number,
      name: ticket.name,
      phone: ticket.phone,
      description: ticket.description,
      deliveredAt: now,
      alreadyCheckedIn: false,
      member: ticket.member
        ? {
            id: ticket.member.id,
            name: ticket.member.name,
            session: {
              id: ticket.member.session.id,
              name: ticket.member.session.name,
            },
          }
        : null,
    };
  },
  {
    auth: true,
    params: paramsSchema,
    body: bodySchema,
    response: {
      200: ticketResponseSchema,
      403: t.Object({ error: t.String() }, { description: "Forbidden" }),
      404: t.Object(
        { error: t.String() },
        { description: "Ticket or Event not found" }
      ),
    },
    detail: {
      summary: "Check-in a ticket by its number (barcode scanner)",
      operationId: "checkInTicket",
    },
  }
);

