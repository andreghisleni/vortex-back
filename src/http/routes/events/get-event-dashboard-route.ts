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
        // totalWithoutCriticaCalabresa,
        // totalWithoutCriticaMista,
        totalValuePayedTickets,
        totalValuePayedTicketsOnLastWeek,
        // membersWithPizzaAndPaymentData,
        totalMembers,
        ticketEventRanges,
        ticketEventRangesLinkedToMembers,
        totalWithoutCriticaPerTicketEventRanges,
        totalWithCriticaPerTicketEventRanges,
      ] = await prisma.$transaction([
        prisma.ticket.count({ where: { eventId: params.id } }),
        prisma.ticket.count({ where: { eventId: params.id, memberId: { not: null } } }),
        prisma.ticket.count({ where: { eventId: params.id, returned: false, memberId: { not: null } } }),
        prisma.ticket.count({ where: { eventId: params.id, deliveredAt: { not: null }, memberId: { not: null } } }),
        prisma.ticket.count({ where: { eventId: params.id, created: 'AFTERIMPORT', memberId: { not: null } } }),
        prisma.ticket.count({ where: { eventId: params.id, returned: true, memberId: { not: null } } }),
        prisma.ticket.count({ where: { eventId: params.id, returned: true, deliveredAt: { not: null }, memberId: { not: null } } }),
        // prisma.ticket.count({ where: { eventId: params.id, returned: false, number: { gte: 0, lte: 1000 }, memberId: { not: null } } }),
        // prisma.ticket.count({ where: { eventId: params.id, returned: false, number: { gte: 2000, lte: 3000 }, memberId: { not: null } } }),
        prisma.payment.findMany({ where: { member: { eventId: params.id }, deletedAt: null } }),
        prisma.payment.findMany({ where: { member: { eventId: params.id }, deletedAt: null, payedAt: { gte: new Date(new Date().setDate(new Date().getDate() - 7)), lte: new Date() } } }),
        // prisma.member.findMany({ where: { eventId: params.id, tickets: { some: { returned: false } } }, include: { tickets: { select: { number: true }, where: { returned: false } }, payments: { select: { amount: true }, where: { deletedAt: null } } } }),
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
      ]);

      const totalValue = totalValuePayedTickets.reduce((acc, ticket) => acc + ticket.amount, 0);
      const totalValueOnLastWeek = totalValuePayedTicketsOnLastWeek.reduce((acc, ticket) => acc + ticket.amount, 0);

      // const processedMembers = membersWithPizzaAndPaymentData.map((member) => {
      //   const { calabresaCount, mistaCount } = member.tickets.reduce((acc, ticket) => {
      //     if (ticket.number >= 0 && ticket.number <= 1000) {
      //       acc.calabresaCount++;
      //     } else if (ticket.number >= 2000 && ticket.number <= 3000) {
      //       acc.mistaCount++;
      //     }
      //     return acc;
      //   }, { calabresaCount: 0, mistaCount: 0 });

      //   const totalPaymentsMade = member.payments.reduce((sum, payment) => sum + payment.amount, 0);

      //   const totalPizzas = calabresaCount + mistaCount;
      //   const totalPizzasCostExpected = totalPizzas * 50;
      //   const isPaidOff = totalPaymentsMade >= totalPizzasCostExpected;

      //   return {
      //     memberId: member.id,
      //     memberName: member.name,
      //     calabresaPizzas: calabresaCount,
      //     mistaPizzas: mistaCount,
      //     totalPizzasOrdered: totalPizzas,
      //     totalPaymentsMade,
      //     totalPizzasCostExpected,
      //     isPaidOff,
      //     isAllConfirmedButNotYetFullyPaid: member.isAllConfirmedButNotYetFullyPaid,
      //     status: isPaidOff ? 'Quitado' : 'Devendo',
      //   };
      // });

      // const payedPerMember = processedMembers.filter((m) => m.isPaidOff).reduce((acc, member) => ({ calabresa: acc.calabresa + member.calabresaPizzas, mista: acc.mista + member.mistaPizzas }), { calabresa: 0, mista: 0 });

      // const possibleTotalTicketsData = processedMembers.filter((m) => m.isPaidOff || (!m.isPaidOff && m.isAllConfirmedButNotYetFullyPaid)).reduce((acc, member) => ({ totalTickets: acc.totalTickets + member.totalPizzasOrdered, calabresa: acc.calabresa + member.calabresaPizzas, mista: acc.mista + member.mistaPizzas }), { totalTickets: 0, calabresa: 0, mista: 0 });

      return {
        totalTickets,
        totalTicketsLinkedToMembers,
        totalWithoutCritica,
        totalDeliveredTickets,
        totalTicketsAfterImport,
        totalWithCritica,
        totalWithCriticaAndDelivered,
        totalPayedTickets: Number((totalValue / 50).toFixed(0)),
        totalPayedTicketsOnLastWeek: Number((totalValueOnLastWeek / 50).toFixed(0)),
        totalValuePayedTickets: totalValue,
        totalValuePayedTicketsOnLastWeek: totalValueOnLastWeek,
        // totalCalabresaPayed: payedPerMember.calabresa,
        // totalMistaPayed: payedPerMember.mista,
        // possibleTotalTickets: possibleTotalTicketsData.totalTickets,
        // totalPredictedCalabresa: possibleTotalTicketsData.calabresa,
        // totalPredictedMista: possibleTotalTicketsData.mista,
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
          // totalCalabresaPayed: t.Number(),
          // totalMistaPayed: t.Number(),
          // possibleTotalTickets: t.Number(),
          // totalPredictedCalabresa: t.Number(),
          // totalPredictedMista: t.Number(),
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
