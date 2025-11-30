import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

const updateEventTicketRangeBodySchema = t.Object(
  {
    start: t.Optional(t.Number()),
    end: t.Optional(t.Number()),
  },
  {
    description: "Schema for updating an event ticket range (can only expand, not shrink)",
  }
);

const paramsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
    id: t.String({ format: "uuid" }),
  },
  {
    description: "Schema for event ticket range parameters",
  }
);

export const updateEventTicketRangeRoute = new Elysia().macro(authMacro).put(
  "/event-ranges/:id",
  async ({ params, body, set }) => {
    // 1. Verificar se o evento existe e não está em modo read-only
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

    // 2. Buscar o range atual
    const currentRange = await prisma.eventTicketRange.findUnique({
      where: { id: params.id },
    });

    if (!currentRange || currentRange.eventId !== params.eventId || currentRange.deletedAt) {
      set.status = 404;
      return { error: "Event ticket range not found" };
    }

    const newStart = body.start ?? currentRange.start;
    const newEnd = body.end ?? currentRange.end;

    // 3. Validar que não está diminuindo a faixa
    // - end só pode aumentar (ou manter)
    // - start só pode diminuir (ou manter)
    if (newEnd < currentRange.end) {
      set.status = 400;
      return {
        error: `Cannot decrease 'end' from ${currentRange.end} to ${newEnd}. This would remove existing tickets.`,
      };
    }

    if (newStart > currentRange.start) {
      set.status = 400;
      return {
        error: `Cannot increase 'start' from ${currentRange.start} to ${newStart}. This would remove existing tickets.`,
      };
    }

    // Se não houve mudança
    if (newStart === currentRange.start && newEnd === currentRange.end) {
      set.status = 200;
      return { message: "No changes made" };
    }

    // 4. Verificar sobreposição com outros ranges do mesmo evento
    const overlappingRanges = await prisma.eventTicketRange.findMany({
      where: {
        eventId: params.eventId,
        id: { not: params.id },
        deletedAt: null,
        OR: [
          // Novo range sobrepõe outro range
          {
            AND: [
              { start: { lte: newEnd } },
              { end: { gte: newStart } },
            ],
          },
        ],
      },
    });

    if (overlappingRanges.length > 0) {
      const conflicting = overlappingRanges[0];
      set.status = 400;
      return {
        error: `New range (${newStart}-${newEnd}) overlaps with existing range "${conflicting.type}" (${conflicting.start}-${conflicting.end})`,
      };
    }

    // 5. Calcular as faixas adicionais (onde precisamos criar tickets)
    const ticketsToCreate: { number: number; eventId: string; ticketRangeId: string }[] = [];

    // Se start diminuiu, precisa criar tickets do newStart até currentRange.start - 1
    if (newStart < currentRange.start) {
      for (let n = newStart; n < currentRange.start; n++) {
        ticketsToCreate.push({
          number: n,
          eventId: params.eventId,
          ticketRangeId: params.id,
        });
      }
    }

    // Se end aumentou, precisa criar tickets do currentRange.end + 1 até newEnd
    if (newEnd > currentRange.end) {
      for (let n = currentRange.end + 1; n <= newEnd; n++) {
        ticketsToCreate.push({
          number: n,
          eventId: params.eventId,
          ticketRangeId: params.id,
        });
      }
    }

    // 6. Verificar se já existem tickets na faixa adicional
    if (ticketsToCreate.length > 0) {
      const ticketNumbers = ticketsToCreate.map((t) => t.number);

      const existingTickets = await prisma.ticket.findMany({
        where: {
          eventId: params.eventId,
          number: { in: ticketNumbers },
        },
        select: { number: true },
      });

      if (existingTickets.length > 0) {
        const existingNumbers = existingTickets.map((t) => t.number).sort((a, b) => a - b);
        set.status = 400;
        return {
          error: `Cannot expand range. Tickets already exist with numbers: ${existingNumbers.join(", ")}`,
        };
      }
    }

    // 7. Executar a atualização e criação de tickets em uma transação
    await prisma.$transaction(async (tx) => {
      // Atualizar o range
      await tx.eventTicketRange.update({
        where: { id: params.id },
        data: {
          start: newStart,
          end: newEnd,
        },
      });

      // Criar os novos tickets
      if (ticketsToCreate.length > 0) {
        await tx.ticket.createMany({
          data: ticketsToCreate,
        });
      }
    });

    set.status = 200;
    return {
      message: `Range updated successfully. ${ticketsToCreate.length} new tickets created.`,
      previousRange: { start: currentRange.start, end: currentRange.end },
      newRange: { start: newStart, end: newEnd },
      ticketsCreated: ticketsToCreate.length,
    };
  },
  {
    auth: true,
    params: paramsSchema,
    body: updateEventTicketRangeBodySchema,
    response: {
      200: t.Object({
        message: t.String(),
        previousRange: t.Optional(t.Object({ start: t.Number(), end: t.Number() })),
        newRange: t.Optional(t.Object({ start: t.Number(), end: t.Number() })),
        ticketsCreated: t.Optional(t.Number()),
      }),
      400: t.Object({
        error: t.String(),
      }),
      403: t.Object({
        error: t.String(),
      }),
      404: t.Object({
        error: t.String(),
      }),
    },
    detail: {
      tags: ["Event - Ticket Ranges"],
      summary: "Update an event ticket range (expand only)",
      description:
        "Updates an event ticket range. Can only expand the range (decrease start or increase end), never shrink. Automatically creates tickets for the new range.",
      operationId: "updateEventTicketRange",
    },
  }
);

