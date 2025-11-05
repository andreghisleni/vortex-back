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
        totalWithoutCritica,
        totalDeliveredTickets,
        totalTicketsAfterImport,
        totalWithCritica,
        totalWithCriticaAndDelivered,
        totalWithoutCriticaCalabresa,
        totalWithoutCriticaMista,
        totalValuePayedTickets,
        totalValuePayedTicketsOnLastWeek,
        membersWithPizzaAndPaymentData,
        totalMembers,
        ticketRanges,
      ] = await prisma.$transaction([
        prisma.ticket.count({ where: { eventId: params.id } }),
        prisma.ticket.count({ where: { eventId: params.id, returned: false } }),
        prisma.ticket.count({ where: { eventId: params.id, deliveredAt: { not: null } } }),
        prisma.ticket.count({ where: { eventId: params.id, created: 'AFTERIMPORT' } }),
        prisma.ticket.count({ where: { eventId: params.id, returned: true } }),
        prisma.ticket.count({ where: { eventId: params.id, returned: true, deliveredAt: { not: null } } }),
        prisma.ticket.count({ where: { eventId: params.id, returned: false, number: { gte: 0, lte: 1000 } } }),
        prisma.ticket.count({ where: { eventId: params.id, returned: false, number: { gte: 2000, lte: 3000 } } }),
        prisma.payment.findMany({ where: { member: { eventId: params.id }, deletedAt: null } }),
        prisma.payment.findMany({ where: { member: { eventId: params.id }, deletedAt: null, payedAt: { gte: new Date(new Date().setDate(new Date().getDate() - 7)), lte: new Date() } } }),
        prisma.member.findMany({ where: { eventId: params.id, tickets: { some: { returned: false } } }, include: { tickets: { select: { number: true }, where: { returned: false } }, payments: { select: { amount: true }, where: { deletedAt: null } } } }),
        prisma.member.count({ where: { eventId: params.id } }),
        prisma.ticketRange.findMany({ where: { eventId: params.id, generatedAt: null, deletedAt: null } }),
      ]);

      const totalValue = totalValuePayedTickets.reduce((acc, ticket) => acc + ticket.amount, 0);
      const totalValueOnLastWeek = totalValuePayedTicketsOnLastWeek.reduce((acc, ticket) => acc + ticket.amount, 0);

      const processedMembers = membersWithPizzaAndPaymentData.map((member) => {
        const { calabresaCount, mistaCount } = member.tickets.reduce((acc, ticket) => {
          if (ticket.number >= 0 && ticket.number <= 1000) {
            acc.calabresaCount++;
          } else if (ticket.number >= 2000 && ticket.number <= 3000) {
            acc.mistaCount++;
          }
          return acc;
        }, { calabresaCount: 0, mistaCount: 0 });

        const totalPaymentsMade = member.payments.reduce((sum, payment) => sum + payment.amount, 0);

        const totalPizzas = calabresaCount + mistaCount;
        const totalPizzasCostExpected = totalPizzas * 50;
        const isPaidOff = totalPaymentsMade >= totalPizzasCostExpected;

        return {
          memberId: member.id,
          memberName: member.name,
          calabresaPizzas: calabresaCount,
          mistaPizzas: mistaCount,
          totalPizzasOrdered: totalPizzas,
          totalPaymentsMade,
          totalPizzasCostExpected,
          isPaidOff,
          isAllConfirmedButNotYetFullyPaid: member.isAllConfirmedButNotYetFullyPaid,
          status: isPaidOff ? 'Quitado' : 'Devendo',
        };
      });

      const payedPerMember = processedMembers.filter((m) => m.isPaidOff).reduce((acc, member) => ({ calabresa: acc.calabresa + member.calabresaPizzas, mista: acc.mista + member.mistaPizzas }), { calabresa: 0, mista: 0 });

      const possibleTotalTicketsData = processedMembers.filter((m) => m.isPaidOff || (!m.isPaidOff && m.isAllConfirmedButNotYetFullyPaid)).reduce((acc, member) => ({ totalTickets: acc.totalTickets + member.totalPizzasOrdered, calabresa: acc.calabresa + member.calabresaPizzas, mista: acc.mista + member.mistaPizzas }), { totalTickets: 0, calabresa: 0, mista: 0 });

      const numbers: number[] = [];
      for (const ticketRange of ticketRanges) {
        if (ticketRange.end) {
          for (let i = ticketRange.start; i <= ticketRange.end; i++) {
            numbers.push(i);
          }
        } else {
          numbers.push(ticketRange.start);
        }
      }

      return {
        totalTickets,
        totalWithoutCritica,
        totalDeliveredTickets,
        totalTicketsAfterImport,
        totalWithCritica,
        totalWithCriticaAndDelivered,
        totalWithoutCriticaCalabresa,
        totalWithoutCriticaMista,
        totalPayedTickets: Number((totalValue / 50).toFixed(0)),
        totalPayedTicketsOnLastWeek: Number((totalValueOnLastWeek / 50).toFixed(0)),
        totalValuePayedTickets: totalValue,
        totalValuePayedTicketsOnLastWeek: totalValueOnLastWeek,
        totalCalabresaPayed: payedPerMember.calabresa,
        totalMistaPayed: payedPerMember.mista,
        possibleTotalTickets: possibleTotalTicketsData.totalTickets,
        totalPredictedCalabresa: possibleTotalTicketsData.calabresa,
        totalPredictedMista: possibleTotalTicketsData.mista,
        totalMembers,
        totalTicketRangeToGenerate: ticketRanges.length,
        totalNumbersToGenerate: numbers.length,
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
          totalWithoutCritica: t.Number(),
          totalDeliveredTickets: t.Number(),
          totalTicketsAfterImport: t.Number(),
          totalWithCritica: t.Number(),
          totalWithCriticaAndDelivered: t.Number(),
          totalWithoutCriticaCalabresa: t.Number(),
          totalWithoutCriticaMista: t.Number(),
          totalPayedTickets: t.Number(),
          totalPayedTicketsOnLastWeek: t.Number(),
          totalValuePayedTickets: t.Number(),
          totalValuePayedTicketsOnLastWeek: t.Number(),
          totalCalabresaPayed: t.Number(),
          totalMistaPayed: t.Number(),
          possibleTotalTickets: t.Number(),
          totalPredictedCalabresa: t.Number(),
          totalPredictedMista: t.Number(),
          totalMembers: t.Number(),
          totalTicketRangeToGenerate: t.Number(),
          totalNumbersToGenerate: t.Number(),
        }, { description: "Event dashboard data" }),
        404: t.Object({
          error: t.String(),
        }, { description: "Event not found" }),
      },
    }
  );
