import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

const ticketTypeSchema = t.Union([t.Literal('SINGLE_NUMERATION'), t.Literal('MULTIPLE_NUMERATIONS')], {
  default: 'SINGLE_NUMERATION',
  description: 'Type of ticketing system used for the event',
});

const eventSchema = t.Object({
  id: t.String({
    format: 'uuid',
    description: 'Unique identifier for the event',
  }),
  name: t.String({
    description: 'Name of the event',
    minLength: 3,
  }),
  description: t.Nullable(t.String({
    description: 'Description of the event',
    maxLength: 500,
  })),
  ticketType: ticketTypeSchema,
  ownerId: t.Nullable(t.String({
    format: 'uuid',
    description: 'Unique identifier for the owner of the event',
  })),
  createdAt: t.Date({
    description: 'Timestamp when the event was created',
  }),
  updatedAt: t.Date({
    description: 'Timestamp when the event was last updated',
  })
});

export const events = new Elysia({
  prefix: '/events',
  name: 'Events',
  tags: ['Events'],

})
  .macro(authMacro)
  .get(
    '/',
    async () => {
      const e = await prisma.event.findMany();

      return e;
    },
    {
      auth: true,
      detail: {
        tags: ['Events'],
        summary: 'Get all events',
        operationId: 'getAllEvents'
      },
      response: {
        200: t.Array(eventSchema)
      }
    }
  )
  .post(
    '/',
    async ({ user, body }) => {
      const event = await prisma.event.create({
        data: {
          ...body,
          ownerId: user.id
        }
      });
      return event;
    },
    {
      detail: {
        tags: ['Events'],
        summary: 'Create a new event',
        operationId: 'createEvent',
      },
      auth: true,
      body: t.Object({
        name: t.String({
          minLength: 3,
          description: 'Name of the event',
        }),
        description: t.Nullable(t.String({
          maxLength: 500,
          description: 'Description of the event',
        })),
        ticketType: ticketTypeSchema,
      }),
      response: {
        200: eventSchema,
        404: t.Object({
          error: t.String(),
        })
      }
    }
  )
  .get(
    '/:id',
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
      return event;
    },
    {
      detail: {
        tags: ['Events'],
        summary: 'Get event by ID',
        operationId: 'getEventById',
      },
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      response: {
        200: eventSchema,
        404: t.Object({
          error: t.String(),
        }),
      },
    }
  )
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

      const [
        totalTickets,
        totalWithoutCritica,
        totalDeliveredTickets,
        totalTicketsAfterImport,
        totalWithCritica,
        totalWithCriticaAndDelivered,
        // totalPayedTickets,
        // totalPayedTicketsOnLastWeek,
        totalWithoutCriticaCalabresa,
        totalWithoutCriticaMista, totalValuePayedTickets,
        totalValuePayedTicketsOnLastWeek,
        membersWithPizzaAndPaymentData,
        totalMembers,
        ticketRanges,
      ] = await prisma.$transaction([
        prisma.ticket.count({
          where: {
            eventId: params.id,
          },
        }),
        prisma.ticket.count({
          where: {
            eventId: params.id,
            returned: false,
          },
        }),
        prisma.ticket.count({
          where: {
            eventId: params.id,
            deliveredAt: {
              not: null,
            },
          },
        }),
        prisma.ticket.count({
          where: {
            eventId: params.id,
            created: 'AFTERIMPORT',
          },
        }),
        prisma.ticket.count({
          where: {
            eventId: params.id,
            returned: true,
          },
        }),
        prisma.ticket.count({
          where: {
            eventId: params.id,
            returned: true,
            deliveredAt: {
              not: null,
            },
          },
        }),
        // prisma.ticket.count({
        //   where: {
        //     ticketPaymentId: {
        //       not: null,
        //     },
        //   },
        // }),
        // prisma.ticket.count({
        //   where: {
        //     ticketPaymentId: {
        //       not: null,
        //     },
        //     ticketPayment: {
        //       payedAt: {
        //         gte: new Date(new Date().setDate(new Date().getDate() - 7)),
        //         lte: new Date(),
        //       },
        //     },
        //   },
        // }),

        prisma.ticket.count({
          where: {
            eventId: params.id,
            returned: false,
            number: {
              gte: 0,
              lte: 1000,
            },
          },
        }),
        prisma.ticket.count({
          where: {
            eventId: params.id,
            returned: false,
            number: {
              gte: 2000,
              lte: 3000,
            },
          },
        }),
        prisma.payment.findMany({
          where: {
            member: {
              eventId: params.id,
            },
            deletedAt: null,
          },
        }),
        prisma.payment.findMany({
          where: {
            member: {
              eventId: params.id,
            },
            deletedAt: null,
            payedAt: {
              gte: new Date(new Date().setDate(new Date().getDate() - 7)),
              lte: new Date(),
            },
          },
        }),
        prisma.member.findMany({
          where: {
            eventId: params.id,

            // payments: {
            //   some: {
            //     deletedAt: null,
            //   },
            // },
            tickets: {
              some: {
                returned: false, // Considera apenas ingressos não retornados
              },
            },
          },
          include: {
            tickets: {
              select: {
                number: true, // Apenas o número do ingresso é necessário para a contagem
              },
              where: {
                returned: false, // Considera apenas ingressos não retornados
              },
            },
            payments: {
              select: {
                amount: true, // Apenas o valor do pagamento é necessário para a soma
              },
              where: {
                deletedAt: null,
              },
            },
          },
        }),
        prisma.member.count({
          where: {
            eventId: params.id,
          }
        }),
        prisma.ticketRange.findMany({
          where: {
            eventId: params.id,
            generatedAt: null,
            deletedAt: null,
          },
        })
      ])


      const totalValue = totalValuePayedTickets.reduce(
        (acc, ticket) => acc + ticket.amount,
        0,
      )

      const totalValueOnLastWeek = totalValuePayedTicketsOnLastWeek.reduce(
        (acc, ticket) => acc + ticket.amount,
        0,
      )

      const processedMembers = membersWithPizzaAndPaymentData.map((member) => {
        const { calabresaCount, mistaCount } = member.tickets.reduce(
          (acc, ticket) => {
            if (ticket.number >= 0 && ticket.number <= 1000) {
              acc.calabresaCount++
            } else if (ticket.number >= 2000 && ticket.number <= 3000) {
              acc.mistaCount++
            }
            return acc
          },
          { calabresaCount: 0, mistaCount: 0 },
        )

        const totalPaymentsMade = member.payments.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        )

        const totalPizzas = calabresaCount + mistaCount
        const totalPizzasCostExpected = totalPizzas * 50
        const isPaidOff = totalPaymentsMade >= totalPizzasCostExpected

        return {
          memberId: member.id,
          memberName: member.name,
          calabresaPizzas: calabresaCount,
          mistaPizzas: mistaCount,
          totalPizzasOrdered: totalPizzas,
          totalPaymentsMade,
          totalPizzasCostExpected,
          isPaidOff,
          isAllConfirmedButNotYetFullyPaid:
            member.isAllConfirmedButNotYetFullyPaid, // Passa o campo para o objeto processado
          status: isPaidOff ? 'Quitado' : 'Devendo',
        }
      })

      const payedPerMember = processedMembers
        .filter((m) => m.isPaidOff)
        .reduce(
          (acc, member) => ({
            calabresa: acc.calabresa + member.calabresaPizzas,
            mista: acc.mista + member.mistaPizzas,
          }),
          {
            calabresa: 0,
            mista: 0,
          },
        )

      const possibleTotalTicketsData = processedMembers
        .filter(
          (m) =>
            m.isPaidOff || (!m.isPaidOff && m.isAllConfirmedButNotYetFullyPaid),
        )
        .reduce(
          (acc, member) => ({
            totalTickets: acc.totalTickets + member.totalPizzasOrdered,
            calabresa: acc.calabresa + member.calabresaPizzas,
            mista: acc.mista + member.mistaPizzas,
          }),
          {
            totalTickets: 0,
            calabresa: 0,
            mista: 0,
          },
        )

      const numbers: number[] = []
      for (const ticketRange of ticketRanges) {
        if (ticketRange.end) {
          for (let i = ticketRange.start; i <= ticketRange.end; i++) {
            numbers.push(i)
          }
        } else {
          numbers.push(ticketRange.start)
        }
      }

      return {
        totalTickets,
        totalWithoutCritica,
        totalDeliveredTickets,
        totalTicketsAfterImport,
        totalWithCritica,
        totalWithCriticaAndDelivered,
        // totalPayedTickets,
        // totalPayedTicketsOnLastWeek,
        totalWithoutCriticaCalabresa,
        totalWithoutCriticaMista,

        totalPayedTickets: Number((totalValue / 50).toFixed(0)),
        totalPayedTicketsOnLastWeek: Number(
          (totalValueOnLastWeek / 50).toFixed(0),
        ),
        totalValuePayedTickets: totalValue,
        totalValuePayedTicketsOnLastWeek: totalValueOnLastWeek,
        totalCalabresaPayed: payedPerMember.calabresa,
        totalMistaPayed: payedPerMember.mista,
        possibleTotalTickets: possibleTotalTicketsData.totalTickets, // Novo campo adicionado
        totalPredictedCalabresa: possibleTotalTicketsData.calabresa, // Novo campo adicionado
        totalPredictedMista: possibleTotalTicketsData.mista, // Novo campo adicionado
        totalMembers,
        totalTicketRangeToGenerate: ticketRanges.length,
        totalNumbersToGenerate: numbers.length,
      }
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
          // totalPayedTickets: t.Number(),
          // totalPayedTicketsOnLastWeek: t.Number(),
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
        }),
        404: t.Object({
          error: t.String(),
        }),
      },
    }
  );
