import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

export const getEventDashboardRoute = new Elysia()
  .macro(authMacro)
  .get(
    '/:id/dashboard',
    async ({ params, set }) => {
      const event = await prisma.event.findUnique({
        where: { id: params.id },
      });
      if (!event) {
        set.status = 404;
        return {
          error: 'Event not found',
        };
      }

      // Reuse existing dashboard logic from previous monolith
      const [
        totalTickets,
        totalTicketsLinkedToMembers,
        totalWithoutCritica,
        totalDeliveredTickets,
        totalTicketsAfterImport,
        totalWithCritica,
        totalWithCriticaAndDelivered,
        totalValuePayedTickets,
        totalValuePayedTicketsOnLastWeek,
        totalMembers,
        ticketEventRanges,
        ticketEventRangesLinkedToMembers,
        totalWithoutCriticaPerTicketEventRanges,
        totalWithCriticaPerTicketEventRanges,
        eventTicketRangesWithCost,
        membersWithTicketsAndPayments,
      ] = await prisma.$transaction([
        prisma.ticket.count({ where: { eventId: params.id } }),
        prisma.ticket.count({ where: { eventId: params.id, memberId: { not: null } } }),
        prisma.ticket.count({ where: { eventId: params.id, returned: false, memberId: { not: null } } }),
        prisma.ticket.count({ where: { eventId: params.id, deliveredAt: { not: null }, memberId: { not: null } } }),
        prisma.ticket.count({ where: { eventId: params.id, created: 'AFTERIMPORT', memberId: { not: null } } }),
        prisma.ticket.count({ where: { eventId: params.id, returned: true, memberId: { not: null } } }),
        prisma.ticket.count({ where: { eventId: params.id, returned: true, deliveredAt: { not: null }, memberId: { not: null } } }),
        prisma.payment.findMany({ where: { member: { eventId: params.id }, deletedAt: null } }),
        prisma.payment.findMany({ where: { member: { eventId: params.id }, deletedAt: null, payedAt: { gte: new Date(new Date().setDate(new Date().getDate() - 7)), lte: new Date() } } }),
        prisma.member.count({ where: { eventId: params.id } }),
        prisma.eventTicketRange.findMany({
          where: { eventId: params.id },
          select: {
            type: true,
            _count: {
              select: {
                tickets: true,
              }
            }
          }
        }),
        prisma.eventTicketRange.findMany({
          where: { eventId: params.id },
          select: {
            type: true,
            _count: {
              select: {
                tickets: {
                  where: {
                    memberId: { not: null },
                  }
                },
              }
            }
          }
        }),
        prisma.eventTicketRange.findMany({
          where: { eventId: params.id },
          select: {
            type: true,
            _count: {
              select: {
                tickets: {
                  where: {
                    deliveredAt: { not: null },
                    returned: false,
                    memberId: { not: null },
                  }
                },
              }
            }
          }
        }),
        prisma.eventTicketRange.findMany({
          where: { eventId: params.id },
          select: {
            type: true,
            _count: {
              select: {
                tickets: {
                  where: {
                    returned: true,
                    deliveredAt: { not: null },
                    memberId: { not: null },
                  }
                },
              }
            }
          }
        }),
        // Buscar EventTicketRanges com custo para calcular valores
        prisma.eventTicketRange.findMany({
          where: { eventId: params.id },
          select: {
            id: true,
            type: true,
            cost: true,
          }
        }),
        // Buscar membros com ingressos (não devolvidos) e pagamentos para calcular quitação
        prisma.member.findMany({
          where: { eventId: params.id, tickets: { some: { returned: false } } },
          include: {
            tickets: {
              where: { returned: false },
              select: {
                ticketRangeId: true,
              }
            },
            payments: {
              where: { deletedAt: null },
              select: { amount: true, payedAt: true }
            }
          }
        }),
      ]);

      const totalValue = totalValuePayedTickets.reduce((acc, ticket) => acc + ticket.amount, 0);
      const totalValueOnLastWeek = totalValuePayedTicketsOnLastWeek.reduce((acc, ticket) => acc + ticket.amount, 0);

      // Criar mapa de custo por EventTicketRange
      const ticketRangeCostMap = new Map<string, { type: string; cost: number }>();
      for (const range of eventTicketRangesWithCost) {
        ticketRangeCostMap.set(range.id, {
          type: range.type,
          cost: range.cost ?? 0,
        });
      }

      // Processar membros para calcular quitação dinâmica por tipo
      const processedMembers = membersWithTicketsAndPayments.map((member) => {
        // Contar ingressos por tipo de EventTicketRange
        const ticketsPerType: Record<string, number> = {};
        let totalCostExpected = 0;

        for (const ticket of member.tickets) {
          if (ticket.ticketRangeId) {
            const rangeInfo = ticketRangeCostMap.get(ticket.ticketRangeId);
            if (rangeInfo) {
              ticketsPerType[rangeInfo.type] = (ticketsPerType[rangeInfo.type] || 0) + 1;
              totalCostExpected += rangeInfo.cost;
            }
          }
        }

        const totalPaymentsMade = member.payments.reduce((sum, payment) => sum + payment.amount, 0);
        const isPaidOff = totalPaymentsMade >= totalCostExpected;
        
        // Encontrar a data do último pagamento
        const lastPaymentDate = member.payments.length > 0
          ? member.payments.reduce((latest, payment) => 
              payment.payedAt > latest ? payment.payedAt : latest, member.payments[0].payedAt)
          : null;

        return {
          memberId: member.id,
          ticketsPerType,
          totalTickets: member.tickets.length,
          totalPaymentsMade,
          totalCostExpected,
          isPaidOff,
          lastPaymentDate,
          isAllConfirmedButNotYetFullyPaid: member.isAllConfirmedButNotYetFullyPaid,
        };
      });

      // Calcular ingressos pagos por tipo (membros quitados)
      const payedPerType: Record<string, number> = {};
      let totalPayedTicketsCount = 0;
      const sevenDaysAgo = new Date(new Date().setDate(new Date().getDate() - 7));
      let totalPayedTicketsOnLastWeekCount = 0;
      
      for (const member of processedMembers.filter((m) => m.isPaidOff)) {
        totalPayedTicketsCount += member.totalTickets;
        
        // Verificar se o último pagamento foi nos últimos 7 dias
        if (member.lastPaymentDate && member.lastPaymentDate >= sevenDaysAgo) {
          totalPayedTicketsOnLastWeekCount += member.totalTickets;
        }
        
        for (const [type, count] of Object.entries(member.ticketsPerType)) {
          payedPerType[type] = (payedPerType[type] || 0) + count;
        }
      }

      // Calcular ingressos não pagos por tipo (membros que ainda não quitaram)
      const unpaidPerType: Record<string, number> = {};
      let totalUnpaidTicketsCount = 0;
      
      for (const member of processedMembers.filter((m) => !m.isPaidOff)) {
        totalUnpaidTicketsCount += member.totalTickets;
        
        for (const [type, count] of Object.entries(member.ticketsPerType)) {
          unpaidPerType[type] = (unpaidPerType[type] || 0) + count;
        }
      }

      // Calcular ingressos confirmados mas não quitados (isAllConfirmedButNotYetFullyPaid = true E não quitado)
      const confirmedButUnpaidPerType: Record<string, number> = {};
      let totalConfirmedButUnpaidTicketsCount = 0;
      
      for (const member of processedMembers.filter((m) => !m.isPaidOff && m.isAllConfirmedButNotYetFullyPaid)) {
        totalConfirmedButUnpaidTicketsCount += member.totalTickets;
        
        for (const [type, count] of Object.entries(member.ticketsPerType)) {
          confirmedButUnpaidPerType[type] = (confirmedButUnpaidPerType[type] || 0) + count;
        }
      }

      // Calcular ingressos previstos por tipo (quitados OU isAllConfirmedButNotYetFullyPaid)
      const predictedPerType: Record<string, number> = {};
      let possibleTotalTickets = 0;
      for (const member of processedMembers.filter((m) => m.isPaidOff || m.isAllConfirmedButNotYetFullyPaid)) {
        possibleTotalTickets += member.totalTickets;
        for (const [type, count] of Object.entries(member.ticketsPerType)) {
          predictedPerType[type] = (predictedPerType[type] || 0) + count;
        }
      }

      // Converter para arrays
      const totalPayedTicketsPerType = Object.entries(payedPerType).map(([type, count]) => ({
        type,
        ticketCount: count,
      }));

      const totalPredictedTicketsPerType = Object.entries(predictedPerType).map(([type, count]) => ({
        type,
        ticketCount: count,
      }));

      const totalUnpaidTicketsPerType = Object.entries(unpaidPerType).map(([type, count]) => ({
        type,
        ticketCount: count,
      }));

      const totalConfirmedButUnpaidTicketsPerType = Object.entries(confirmedButUnpaidPerType).map(([type, count]) => ({
        type,
        ticketCount: count,
      }));

      return {
        totalTickets,
        totalTicketsLinkedToMembers,
        totalWithoutCritica,
        totalDeliveredTickets,
        totalTicketsAfterImport,
        totalWithCritica,
        totalWithCriticaAndDelivered,
        totalPayedTickets: totalPayedTicketsCount,
        totalPayedTicketsOnLastWeek: totalPayedTicketsOnLastWeekCount,
        totalValuePayedTickets: totalValue,
        totalValuePayedTicketsOnLastWeek: totalValueOnLastWeek,
        totalPayedTicketsPerType,
        totalUnpaidTickets: totalUnpaidTicketsCount,
        totalUnpaidTicketsPerType,
        totalConfirmedButUnpaidTickets: totalConfirmedButUnpaidTicketsCount,
        totalConfirmedButUnpaidTicketsPerType,
        possibleTotalTickets,
        totalPredictedTicketsPerType,
        totalMembers,
        totalTicketsPerRange: ticketEventRanges.map((range) => ({
          type: range.type,
          ticketCount: range._count.tickets,
        })),
        totalTicketsPerRangeLinkedToMembers: ticketEventRangesLinkedToMembers.map((range) => ({
          type: range.type,
          ticketCount: range._count.tickets,
        })),
        totalWithoutCriticaPerTicketEventRanges: totalWithoutCriticaPerTicketEventRanges.map((range) => ({
          type: range.type,
          ticketCount: range._count.tickets,
        })),
        totalWithCriticaPerTicketEventRanges: totalWithCriticaPerTicketEventRanges.map((range) => ({
          type: range.type,
          ticketCount: range._count.tickets,
        })),
      };
    },
    {
      detail: {
        tags: ['Events'],
        summary: 'Get event dashboard data by ID',
        operationId: 'getEventDashboardDataById',
      },
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      response: {
        200: t.Object({
          totalTickets: t.Number(),
          totalTicketsLinkedToMembers: t.Number(),
          totalWithoutCritica: t.Number(),
          totalDeliveredTickets: t.Number(),
          totalTicketsAfterImport: t.Number(),
          totalWithCritica: t.Number(),
          totalWithCriticaAndDelivered: t.Number(),
          totalPayedTickets: t.Number(),
          totalPayedTicketsOnLastWeek: t.Number(),
          totalValuePayedTickets: t.Number(),
          totalValuePayedTicketsOnLastWeek: t.Number(),
          totalPayedTicketsPerType: t.Array(t.Object({
            type: t.String(),
            ticketCount: t.Number(),
          })),
          totalUnpaidTickets: t.Number(),
          totalUnpaidTicketsPerType: t.Array(t.Object({
            type: t.String(),
            ticketCount: t.Number(),
          })),
          totalConfirmedButUnpaidTickets: t.Number(),
          totalConfirmedButUnpaidTicketsPerType: t.Array(t.Object({
            type: t.String(),
            ticketCount: t.Number(),
          })),
          possibleTotalTickets: t.Number(),
          totalPredictedTicketsPerType: t.Array(t.Object({
            type: t.String(),
            ticketCount: t.Number(),
          })),
          totalMembers: t.Number(),
          totalTicketsPerRange: t.Array(t.Object({
            type: t.String(),
            ticketCount: t.Number(),
          })),
          totalTicketsPerRangeLinkedToMembers: t.Array(t.Object({
            type: t.String(),
            ticketCount: t.Number(),
          })),
          totalWithoutCriticaPerTicketEventRanges: t.Array(t.Object({
            type: t.String(),
            ticketCount: t.Number(),
          })),
          totalWithCriticaPerTicketEventRanges: t.Array(t.Object({
            type: t.String(),
            ticketCount: t.Number(),
          })),
        }, { description: "Event dashboard data" }),
        404: t.Object({
          error: t.String(),
        }, { description: "Event not found" }),
      },
    }
  );
