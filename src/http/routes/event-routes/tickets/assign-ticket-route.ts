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

const bodySchema = t.Object(
  {
    memberId: t.String({ format: "uuid" }),
  },
  {
    description: "Body containing the memberId to assign the ticket to",
  }
);

export const assignTicketRoute = new Elysia().macro(authMacro).post(
  "/:ticketId/assign",
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

    const ticket = await prisma.ticket.findUnique({
      where: { id: params.ticketId },
    });
    if (!ticket || ticket.eventId !== params.eventId) {
      set.status = 404;
      return { error: "Ticket not found for this event" };
    }

    const member = await prisma.member.findUnique({
      where: { id: body.memberId },
    });
    if (!member || member.eventId !== params.eventId) {
      set.status = 400;
      return { error: "Member not found or does not belong to this event" };
    }

    // se forneceu allocationId, verificar se pertence ao membro e ao event
    if (body.allocationId) {
      const alloc = await prisma.memberTicketAllocation.findUnique({
        where: { id: body.allocationId },
      });
      if (!alloc || alloc.memberId !== body.memberId) {
        set.status = 400;
        return { error: "Invalid allocationId for this member" };
      }
    }

    // executar atualização e criar fluxo
    await prisma.$transaction([
      prisma.ticket.update({
        where: { id: ticket.id },
        data: { memberId: body.memberId },
      }),
      prisma.ticketFlow.create({
        data: {
          ticketId: ticket.id,
          eventId: params.eventId,
          type: "ASSIGNED",
          fromMemberId: null,
          toMemberId: body.memberId,
          performedBy: user?.id ?? null,
        },
      }),
    ]);

    set.status = 200;
    return { success: true };
  },
  {
    auth: true,
    params: paramsSchema,
    body: bodySchema,
    response: {
      200: t.Object(
        { success: t.Boolean() },
        { description: "Ticket assigned successfully" }
      ),
      400: t.Object({ error: t.String() }, { description: "Invalid request" }),
      403: t.Object({ error: t.String() }, { description: "Forbidden" }),
      404: t.Object(
        { error: t.String() },
        { description: "Ticket or Event not found" }
      ),
    },
    detail: {
      summary: "Assign a ticket to a member (and optional allocation)",
      operationId: "assignTicket",
    },
  }
);
