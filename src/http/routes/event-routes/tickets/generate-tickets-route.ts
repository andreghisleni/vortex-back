import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

const eventParamsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
  },
  {
    description: "Parameters including eventId",
  }
);

export const generateTicketsRoute = new Elysia().macro(authMacro).post(
  "/generate",
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

    // Buscar ranges ativos do evento
    const ranges = await prisma.eventTicketRange.findMany({
      where: { eventId: params.eventId, deletedAt: null },
      orderBy: { start: "asc" },
    });

    if (ranges.length === 0) {
      set.status = 400;
      return { error: "No ticket ranges defined for this event" };
    }

    // Buscar membros do evento ordenados por order ASC (nulls last)
    const members = await prisma.member.findMany({
      where: { eventId: params.eventId },
      orderBy: { order: "asc" },
      include: {
        ticketAllocations: true,
      },
    });

    if (members.length === 0) {
      set.status = 400;
      return { error: "No members found for this event" };
    }

    // Buscar alocações com deficit (quantity > linked_count) e ordenadas por members.order asc
    const allocations = (await prisma.$queryRaw`
      SELECT
        a.id AS allocation_id,
        a.member_id,
        a.event_ticket_range_id,
        a.quantity,
        COALESCE(linked.linked_count, 0) AS linked_count,
        (a.quantity - COALESCE(linked.linked_count, 0)) AS deficit,
        m.order AS member_order
      FROM member_ticket_allocations a
      JOIN members m ON m.id = a.member_id
      LEFT JOIN LATERAL (
        SELECT count(1) AS linked_count
        FROM tickets t
        WHERE t.allocation_id = a.id
      ) linked ON true
      WHERE m.event_id = ${params.eventId}
        AND a.quantity > COALESCE(linked.linked_count, 0)
      ORDER BY m.order ASC
    `) as Array<{
      allocation_id: string;
      member_id: string;
      event_ticket_range_id: string;
      quantity: number;
      linked_count: number;
      deficit: number;
      member_order: number;
    }>;

    // Pré-buscar números já criados para todos os ranges de uma vez
    const ticketsExisting = await prisma.ticket.findMany({
      where: {
        eventId: params.eventId,
        ticketRangeId: { in: ranges.map((r) => r.id) },
      },
      select: { number: true, ticketRangeId: true },
    });
    const existingByRange: Record<string, Set<number>> = {};
    for (const existingTicket of ticketsExisting) {
      const key = existingTicket.ticketRangeId ?? "";
      existingByRange[key] = existingByRange[key] || new Set<number>();
      existingByRange[key].add(existingTicket.number);
    }

    // Agora, em vez de criar novos números, vamos vincular tickets já existentes (não atribuídos) aos membros
    // Buscar tickets não atribuídos por range (ordenados por number)
    const unassignedTickets = await prisma.ticket.findMany({
      where: {
        eventId: params.eventId,
        ticketRangeId: { in: ranges.map((r) => r.id) },
        memberId: null,
      },
      orderBy: { number: "asc" },
      select: { id: true, number: true, ticketRangeId: true },
    });

    if (unassignedTickets.length === 0) {
      set.status = 200;
      return { message: "No unassigned tickets available" };
    }

    // Agrupar tickets por range para atribuição por range
    const unassignedByRange: Record<string, { id: string; number: number }[]> =
      {};
    for (const ticketRow of unassignedTickets) {
      unassignedByRange[ticketRow.ticketRangeId ?? ""] =
        unassignedByRange[ticketRow.ticketRangeId ?? ""] || [];
      unassignedByRange[ticketRow.ticketRangeId ?? ""].push({
        id: ticketRow.id,
        number: ticketRow.number,
      });
    }

    // Preparar operações de atualização e criação de flows
    const ops: (
      | ReturnType<typeof prisma.ticket.updateMany>
      | ReturnType<typeof prisma.ticketFlow.create>
    )[] = [];
    let assignedCount = 0;

    // Iterar pelas alocações com deficit e consumir os pools de tickets não vinculados por range
    for (const alloc of allocations) {
      const pool = unassignedByRange[alloc.event_ticket_range_id] ?? [];
      if (pool.length === 0) {
        continue;
      }

      const need = Number(alloc.deficit) || 0;
      if (need <= 0) {
        continue;
      }

      const slice = pool.splice(0, need);
      if (slice.length === 0) {
        continue;
      }

      const ids = slice.map((s) => s.id);
      // atualizar tickets: atribuir memberId e linkar allocationId
      ops.push(
        prisma.ticket.updateMany({
          where: { id: { in: ids } },
          data: {
            memberId: alloc.member_id,
            allocationId: alloc.allocation_id,
          },
        })
      );

      // criar flows ASSIGNED para cada ticket atribuído
      for (const s of slice) {
        ops.push(
          prisma.ticketFlow.create({
            data: {
              ticketId: s.id,
              eventId: params.eventId,
              type: "ASSIGNED",
              fromMemberId: null,
              toMemberId: alloc.member_id,
              performedBy: user?.id ?? null,
            },
          })
        );
      }

      assignedCount += slice.length;
    }

    // Executar todas as operações em uma única transação para atomicidade
    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }

    set.status = 201;
    return { assigned: assignedCount };
  },
  {
    auth: true,
    params: eventParamsSchema,
    response: {
      201: t.Object(
        { assigned: t.Number() },
        { description: "Tickets generated and assigned successfully" }
      ),
      200: t.Object(
        { message: t.String() },
        { description: "No unassigned tickets available" }
      ),
      400: t.Object(
        { error: t.String() },
        { description: "Bad request - missing ranges or members" }
      ),
      403: t.Object(
        { error: t.String() },
        { description: "Event is read-only" }
      ),
      404: t.Object({ error: t.String() }, { description: "Event not found" }),
    },
    detail: {
      summary: "Generate tickets for an event based on ranges and allocations",
      operationId: "generateEventTickets",
    },
  }
);
