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
          totalTickets: t.Number({ description: "Total de ingressos do evento (todos os ingressos, independente de estarem vinculados a membros)" }),
          totalTicketsLinkedToMembers: t.Number({ description: "Total de ingressos vinculados a membros (memberId não nulo)" }),
          totalWithoutCritica: t.Number({ description: "Total de ingressos não devolvidos (returned = false) e vinculados a membros" }),
          totalDeliveredTickets: t.Number({ description: "Total de ingressos entregues (deliveredAt não nulo) e vinculados a membros" }),
          totalTicketsAfterImport: t.Number({ description: "Total de ingressos criados após importação (created = 'AFTERIMPORT') e vinculados a membros" }),
          totalWithCritica: t.Number({ description: "Total de ingressos devolvidos (returned = true) e vinculados a membros" }),
          totalWithCriticaAndDelivered: t.Number({ description: "Total de ingressos devolvidos (returned = true) e entregues (deliveredAt não nulo) vinculados a membros" }),
          totalPayedTickets: t.Number({ description: "Total de ingressos pagos (contagem de ingressos de membros quitados, onde totalPaymentsMade >= totalCostExpected)" }),
          totalPayedTicketsOnLastWeek: t.Number({ description: "Total de ingressos pagos na última semana (ingressos de membros quitados cujo último pagamento foi nos últimos 7 dias)" }),
          totalValuePayedTickets: t.Number({ description: "Valor total pago em ingressos (soma de todos os pagamentos não deletados de membros do evento)" }),
          totalValuePayedTicketsOnLastWeek: t.Number({ description: "Valor total pago em ingressos na última semana (soma de pagamentos não deletados realizados nos últimos 7 dias)" }),
          totalPayedTicketsPerType: t.Array(t.Object({
            type: t.String({ description: "Tipo da faixa de preço do ingresso" }),
            ticketCount: t.Number({ description: "Quantidade de ingressos pagos deste tipo (de membros quitados)" }),
          }), { description: "Array com a contagem de ingressos pagos agrupados por tipo de faixa de preço" }),
          totalUnpaidTickets: t.Number({ description: "Total de ingressos não pagos (contagem de ingressos de membros que ainda não quitaram, onde totalPaymentsMade < totalCostExpected)" }),
          totalUnpaidTicketsPerType: t.Array(t.Object({
            type: t.String({ description: "Tipo da faixa de preço do ingresso" }),
            ticketCount: t.Number({ description: "Quantidade de ingressos não pagos deste tipo (de membros não quitados)" }),
          }), { description: "Array com a contagem de ingressos não pagos agrupados por tipo de faixa de preço" }),
          totalConfirmedButUnpaidTickets: t.Number({ description: "Total de ingressos confirmados mas não quitados (ingressos de membros com isAllConfirmedButNotYetFullyPaid = true e que ainda não quitaram)" }),
          totalConfirmedButUnpaidTicketsPerType: t.Array(t.Object({
            type: t.String({ description: "Tipo da faixa de preço do ingresso" }),
            ticketCount: t.Number({ description: "Quantidade de ingressos confirmados mas não pagos deste tipo" }),
          }), { description: "Array com a contagem de ingressos confirmados mas não quitados agrupados por tipo de faixa de preço" }),
          possibleTotalTickets: t.Number({ description: "Total possível de ingressos (soma de ingressos de membros quitados OU com isAllConfirmedButNotYetFullyPaid = true)" }),
          totalPredictedTicketsPerType: t.Array(t.Object({
            type: t.String({ description: "Tipo da faixa de preço do ingresso" }),
            ticketCount: t.Number({ description: "Quantidade de ingressos previstos deste tipo (de membros quitados ou confirmados)" }),
          }), { description: "Array com a contagem de ingressos previstos agrupados por tipo de faixa de preço (quitados ou confirmados)" }),
          totalMembers: t.Number({ description: "Total de membros do evento" }),
          totalTicketsPerRange: t.Array(t.Object({
            type: t.String({ description: "Tipo da faixa de preço do ingresso" }),
            ticketCount: t.Number({ description: "Quantidade total de ingressos desta faixa de preço" }),
          }), { description: "Array com a contagem total de ingressos agrupados por faixa de preço (todos os ingressos, independente de estarem vinculados a membros)" }),
          totalTicketsPerRangeLinkedToMembers: t.Array(t.Object({
            type: t.String({ description: "Tipo da faixa de preço do ingresso" }),
            ticketCount: t.Number({ description: "Quantidade de ingressos desta faixa de preço vinculados a membros" }),
          }), { description: "Array com a contagem de ingressos vinculados a membros agrupados por faixa de preço" }),
          totalWithoutCriticaPerTicketEventRanges: t.Array(t.Object({
            type: t.String({ description: "Tipo da faixa de preço do ingresso" }),
            ticketCount: t.Number({ description: "Quantidade de ingressos não devolvidos (returned = false) e entregues (deliveredAt não nulo) desta faixa de preço vinculados a membros" }),
          }), { description: "Array com a contagem de ingressos não devolvidos e entregues agrupados por faixa de preço" }),
          totalWithCriticaPerTicketEventRanges: t.Array(t.Object({
            type: t.String({ description: "Tipo da faixa de preço do ingresso" }),
            ticketCount: t.Number({ description: "Quantidade de ingressos devolvidos (returned = true) e entregues (deliveredAt não nulo) desta faixa de preço vinculados a membros" }),
          }), { description: "Array com a contagem de ingressos devolvidos e entregues agrupados por faixa de preço" }),
        }, { description: "Event dashboard data" }),
        404: t.Object({
          error: t.String(),
        }, { description: "Event not found" }),
      },
    }
  );
