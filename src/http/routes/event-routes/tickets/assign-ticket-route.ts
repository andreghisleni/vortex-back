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
    ticketIds: t.Array(t.String({ format: "uuid" }), { minItems: 1 }),
    memberId: t.String({ format: "uuid" }),
  },
  {
    description: "Body containing the ticketIds and memberId to assign the tickets to",
  }
);

export const assignTicketRoute = new Elysia().macro(authMacro).post(
  "/assign",
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

    // Buscar todos os tickets
    const tickets = await prisma.ticket.findMany({
      where: {
        id: { in: body.ticketIds },
        eventId: params.eventId,
      },
    });

    if (tickets.length !== body.ticketIds.length) {
      const foundIds = new Set(tickets.map((t) => t.id));
      const notFound = body.ticketIds.filter((id: string) => !foundIds.has(id));
      set.status = 404;
      return { error: `Tickets not found for this event: ${notFound.join(", ")}` };
    }

    // Verificar se algum ticket já está vinculado a um membro
    const alreadyAssigned = tickets.filter((t) => t.memberId !== null);
    if (alreadyAssigned.length > 0) {
      set.status = 400;
      return {
        error: `Tickets already assigned to a member: ${alreadyAssigned.map((t) => t.number).join(", ")}`,
      };
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

    // executar atualização e criar fluxos para todos os tickets
    await prisma.$transaction([
      prisma.ticket.updateMany({
        where: { id: { in: body.ticketIds } },
        data: { memberId: body.memberId },
      }),
      prisma.ticketFlow.createMany({
        data: tickets.map((ticket) => ({
          ticketId: ticket.id,
          eventId: params.eventId,
          type: "ASSIGNED" as const,
          fromMemberId: null,
          toMemberId: body.memberId,
          performedBy: user?.id ?? null,
        })),
      }),
    ]);

    set.status = 200;
    return { success: true, assignedCount: tickets.length };
  },
  {
    auth: true,
    params: paramsSchema,
    body: bodySchema,
    response: {
      200: t.Object(
        { success: t.Boolean(), assignedCount: t.Number() },
        { description: "Tickets assigned successfully" }
      ),
      400: t.Object({ error: t.String() }, { description: "Invalid request" }),
      403: t.Object({ error: t.String() }, { description: "Forbidden" }),
      404: t.Object(
        { error: t.String() },
        { description: "Tickets or Event not found" }
      ),
    },
    detail: {
      summary: "Assign multiple tickets to a member (and optional allocation)",
      operationId: "assignTickets",
    },
  }
);
