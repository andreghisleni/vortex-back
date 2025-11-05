import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

const paramsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
    ticketId: t.String({ format: "uuid" }),
  },
  {
    description: "Parameters including eventId and ticketId",
  }
);

export const unassignTicketRoute = new Elysia().macro(authMacro).post(
  "/:ticketId/unassign",
  async ({ params, set, user }) => {
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

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.ticketId },
    });
    if (!ticket || ticket.eventId !== params.eventId) {
      set.status = 404;
      return { error: "Ticket not found for this event" };
    }

    if (!ticket.memberId) {
      set.status = 400;
      return { error: "Ticket is not assigned to any member" };
    }

    const wasReturned = Boolean(ticket.returned);

    // executar desvinculação: limpar memberId e allocationId; se estava devolvido, limpar returned
    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          memberId: null,
          allocationId: null,
          returned: false,
        },
      }),
      prisma.ticketFlow.create({
        data: {
          ticketId: ticket.id,
          eventId: params.eventId,
          type: "DETACHED",
          fromMemberId: ticket.memberId,
          toMemberId: null,
          performedBy: user?.id ?? null,
        },
      }),
    ]);

    set.status = 200;
    return { success: true, wasReturned };
  },
  {
    auth: true,
    params: paramsSchema,
    response: {
      200: t.Object(
        { success: t.Boolean(), wasReturned: t.Boolean() },
        { description: "Ticket unassigned successfully" }
      ),
      400: t.Object({ error: t.String() }, { description: "Bad Request" }),
      403: t.Object({ error: t.String() }, { description: "Forbidden" }),
      404: t.Object({ error: t.String() }, { description: "Not Found" }),
    },
    detail: {
      summary: "Unassign a ticket from its member",
      operationId: "unassignTicket",
    },
  }
);
