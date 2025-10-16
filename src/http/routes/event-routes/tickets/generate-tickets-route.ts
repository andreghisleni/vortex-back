import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

const eventParamsSchema = t.Object({
  eventId: t.String({ format: 'uuid' }),
});

export const generateTicketsRoute = new Elysia()
  .macro(authMacro)
  .post(
    '/generate',
    async ({ params, set, user }) => {
      const event = await prisma.event.findUnique({ where: { id: params.eventId } });
      if (!event) {
        set.status = 404;
        return { error: 'Event not found' };
      }
      if (event.readOnly) {
        set.status = 403;
        return { error: 'Event is read-only' };
      }

      // Buscar ranges ativos do evento
      const ranges = await prisma.eventTicketRange.findMany({ where: { eventId: params.eventId, deletedAt: null }, orderBy: { start: 'asc' } });

      if (ranges.length === 0) {
        set.status = 400;
        return { error: 'No ticket ranges defined for this event' };
      }

      // Buscar membros do evento ordenados por order ASC (nulls last)
      const members = await prisma.member.findMany({ where: { eventId: params.eventId }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });

      if (members.length === 0) {
        set.status = 400;
        return { error: 'No members found for this event' };
      }

      // Pré-carregar alocações por membro
      const allocations = await prisma.memberTicketAllocation.findMany({ where: { member: { eventId: params.eventId } } });

      const allocationsByMember: Record<string, Record<string, number>> = {};
      for (const a of allocations) {
        allocationsByMember[a.memberId] = allocationsByMember[a.memberId] || {};
        allocationsByMember[a.memberId][a.eventTicketRangeId] = a.quantity;
      }

      // Pré-buscar números já criados para todos os ranges de uma vez
      const ticketsExisting = await prisma.ticket.findMany({ where: { eventId: params.eventId, ticketRangeId: { in: ranges.map((r) => r.id) } }, select: { number: true, ticketRangeId: true } });
      const existingByRange: Record<string, Set<number>> = {};
      for (const existingTicket of ticketsExisting) {
        const key = existingTicket.ticketRangeId ?? '';
        existingByRange[key] = existingByRange[key] || new Set<number>();
        existingByRange[key].add(existingTicket.number);
      }

      // Agora, em vez de criar novos números, vamos vincular tickets já existentes (não atribuídos) aos membros
      // Buscar tickets não atribuídos por range (ordenados por number)
      const unassignedTickets = await prisma.ticket.findMany({ where: { eventId: params.eventId, ticketRangeId: { in: ranges.map((r) => r.id) }, memberId: null }, orderBy: { number: 'asc' }, select: { id: true, number: true, ticketRangeId: true } });

      if (unassignedTickets.length === 0) {
        set.status = 200;
        return { message: 'No unassigned tickets available' };
      }

      // Agrupar tickets por range para atribuição por range
      const unassignedByRange: Record<string, { id: string; number: number }[]> = {};
      for (const ticketRow of unassignedTickets) {
        unassignedByRange[ticketRow.ticketRangeId ?? ''] = unassignedByRange[ticketRow.ticketRangeId ?? ''] || [];
        unassignedByRange[ticketRow.ticketRangeId ?? ''].push({ id: ticketRow.id, number: ticketRow.number });
      }

      // Preparar operações de atualização e criação de flows
      const ops: (ReturnType<typeof prisma.ticket.updateMany> | ReturnType<typeof prisma.ticketFlow.create>)[] = [];
      let assignedCount = 0;

      for (const range of ranges) {
        const pool = unassignedByRange[range.id] ?? [];
        if (pool.length === 0) {
          continue;
        }

        // determinar quantidades por membro para esse range
        const perMemberQuantities: number[] = [];
        if (event.autoGenerateTicketsTotalPerMember != null) {
          for (const _m of members) {
            perMemberQuantities.push(event.autoGenerateTicketsTotalPerMember as number);
          }
        } else {
          for (const m of members) {
            perMemberQuantities.push(allocationsByMember[m.id]?.[range.id] ?? 0);
          }
        }

        // atribuir tickets do pool seguindo a ordem dos membros
        let idx = 0;
        for (let i = 0; i < members.length && idx < pool.length; i++) {
          const qty = perMemberQuantities[i] || 0;
          if (qty <= 0) {
            continue;
          }
          const slice = pool.slice(idx, idx + qty);
          if (slice.length === 0) {
            break;
          }

          const ids = slice.map((s) => s.id);
          // update tickets to assign to member
          ops.push(prisma.ticket.updateMany({ where: { id: { in: ids } }, data: { memberId: members[i].id } }));

          // criar flows ASSIGNED para cada ticket atribuído, incluindo performedBy quando disponível
          for (const s of slice) {
            ops.push(prisma.ticketFlow.create({ data: { ticketId: s.id, eventId: params.eventId, type: 'ASSIGNED', fromMemberId: null, toMemberId: members[i].id, performedBy: user?.id ?? null } }));
          }

          assignedCount += slice.length;
          idx += slice.length;
        }
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
        201: t.Object({ assigned: t.Number() }),
        200: t.Object({ message: t.String() }),
        400: t.Object({ error: t.String() }),
        403: t.Object({ error: t.String() }),
        404: t.Object({ error: t.String() }),
      },
      detail: {
        summary: 'Generate tickets for an event based on ranges and allocations',
        operationId: 'generateEventTickets',
      },
    }
  );
