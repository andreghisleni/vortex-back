import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

// Schema para Payment
const paymentSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  amount: t.Number(),
  type: t.Union([t.Literal('PIX'), t.Literal('CASH')]),
  payedAt: t.Date(),
});

// Schema para Ticket dentro de Member
const memberTicketSchema = t.Object({
  number: t.Number(),
  ticketRangeId: t.Nullable(t.String({ format: 'uuid' })),
  deliveredAt: t.Nullable(t.Date()),
  returned: t.Boolean(),
});

// Schema para ticketsByRange
const ticketsByRangeSchema = t.Object({
  eventTicketRangeId: t.String({ format: 'uuid' }),
  quantity: t.Number(),
  totalValue: t.Number(),
});

// Schema para o modelo Member na exportação
const exportMemberSchema = t.Object({
  visionId: t.Nullable(t.String()),
  name: t.String(),
  session: t.Object({
    name: t.String(),
  }),
  tickets: t.Array(memberTicketSchema),
  payments: t.Array(paymentSchema),
  ticketsByRange: t.Array(ticketsByRangeSchema),
  // Campos calculados opcionais
  totalAmount: t.Number(),
  totalPayed: t.Number(),
  totalPayedWithPix: t.Number(),
  totalPayedWithCash: t.Number(),
  total: t.Number(), // Balance (totalPayed - totalAmount)
});

// Schema para o modelo Ticket na exportação (apenas campos necessários)
const exportTicketSchema = t.Object({
  number: t.Number(),
  returned: t.Boolean(),
  member: t.Nullable(t.Object({
    name: t.String(),
    session: t.Object({
      name: t.String(),
    }),
  })),
});

// Schema para os parâmetros que incluem eventId
const eventParamsSchema = t.Object({
  eventId: t.String({ format: 'uuid' }),
});

export const getExportDataRoute = new Elysia()
  .macro(authMacro)
  .get(
    '/member-ticket/export',
    async ({ params }) => {
      // Buscar EventTicketRanges com custo para calcular valores
      const eventTicketRanges = await prisma.eventTicketRange.findMany({
        where: { eventId: params.eventId },
        select: {
          id: true,
          cost: true,
        },
      });

      // Criar mapa de custo por EventTicketRange
      const ticketRangeCostMap = new Map<string, number>();
      for (const range of eventTicketRanges) {
        ticketRangeCostMap.set(range.id, range.cost ?? 0);
      }

      // Buscar membros que têm tickets não entregues/não devolvidos com todos os dados necessários
      const membersWithPendingTickets = await prisma.member.findMany({
        where: {
          eventId: params.eventId,
          tickets: {
            some: {
              AND: [
                { deliveredAt: null },
                { returned: false },
              ],
            },
          },
        },
        select: {
          visionId: true,
          name: true,
          session: {
            select: {
              name: true,
            }
          },
          tickets: {
            where: {
              returned: false, // Apenas tickets não devolvidos para cálculos
            },
            select: {
              number: true,
              ticketRangeId: true,
              deliveredAt: true,
              returned: true,
            }
          },
          payments: {
            where: {
              deletedAt: null, // Apenas pagamentos não deletados
            },
            select: {
              id: true,
              amount: true,
              type: true,
              payedAt: true,
            },
            orderBy: {
              payedAt: 'asc',
            },
          },
        },
        orderBy: [
          { session: { name: 'asc' } },
          { name: 'asc' },
        ],
      });

      // Processar membros para adicionar campos calculados e ticketsByRange
      const processedMembers = membersWithPendingTickets.map((member) => {
        // Calcular totalPayed, totalPayedWithPix, totalPayedWithCash
        const totalPayed = member.payments.reduce((sum, payment) => sum + payment.amount, 0);
        const totalPayedWithPix = member.payments
          .filter((p) => p.type === 'PIX')
          .reduce((sum, payment) => sum + payment.amount, 0);
        const totalPayedWithCash = member.payments
          .filter((p) => p.type === 'CASH')
          .reduce((sum, payment) => sum + payment.amount, 0);

        // Agrupar tickets por ticketRangeId e calcular valores
        const ticketsByRangeMap = new Map<string, { quantity: number; totalValue: number }>();
        let totalAmount = 0;

        for (const ticket of member.tickets) {
          if (ticket.ticketRangeId) {
            const cost = ticketRangeCostMap.get(ticket.ticketRangeId) ?? 0;
            const existing = ticketsByRangeMap.get(ticket.ticketRangeId);
            if (existing) {
              existing.quantity += 1;
              existing.totalValue += cost;
            } else {
              ticketsByRangeMap.set(ticket.ticketRangeId, {
                quantity: 1,
                totalValue: cost,
              });
            }
            totalAmount += cost;
          }
        }

        // Converter ticketsByRangeMap para array
        const ticketsByRange = Array.from(ticketsByRangeMap.entries()).map(
          ([eventTicketRangeId, data]) => ({
            eventTicketRangeId,
            quantity: data.quantity,
            totalValue: data.totalValue,
          })
        );

        // Calcular balance (totalPayed - totalAmount)
        const total = totalPayed - totalAmount;

        return {
          visionId: member.visionId,
          name: member.name,
          session: member.session,
          tickets: member.tickets.map((ticket) => ({
            number: ticket.number,
            ticketRangeId: ticket.ticketRangeId,
            deliveredAt: ticket.deliveredAt,
            returned: ticket.returned,
          })),
          payments: member.payments.map((payment) => ({
            id: payment.id,
            amount: payment.amount,
            type: payment.type,
            payedAt: payment.payedAt,
          })),
          ticketsByRange,
          totalAmount,
          totalPayed,
          totalPayedWithPix,
          totalPayedWithCash,
          total,
        };
      });

      // Ordenar membros: quem pagou mais até os que estão devendo (ordenar por total descendente)
      processedMembers.sort((a, b) => b.total - a.total);

      // Buscar tickets não entregues/não devolvidos (apenas campos necessários)
      const pendingTickets = await prisma.ticket.findMany({
        where: {
          eventId: params.eventId,
          deliveredAt: null,
          returned: false,
        },
        select: {
          number: true,
          returned: true,
          member: {
            select: {
              name: true,
              session: {
                select: {
                  name: true,
                }
              }
            }
          }
        },
        orderBy: { number: 'asc' },
      });

      // Buscar tickets com crítica (entregues E devolvidos) - apenas campos necessários
      const ticketsWithCritica = await prisma.ticket.findMany({
        where: {
          eventId: params.eventId,
          returned: true,
          deliveredAt: { not: null },
        },
        select: {
          number: true,
          returned: true,
          member: {
            select: {
              name: true,
              session: {
                select: {
                  name: true,
                }
              }
            }
          }
        },
        orderBy: { number: 'asc' },
      });

      return {
        // Membros com tickets pendentes (com todos os dados adicionais)
        members: processedMembers,
        // Tickets pendentes (equivale ao filtro JS atual)
        tickets: pendingTickets,
        // Tickets com crítica (equivale ao filtro JS atual)
        ticketsWithCritica,
      };
    },
    {
      auth: true,
      params: eventParamsSchema,
      response: t.Object({
        members: t.Array(exportMemberSchema),
        tickets: t.Array(exportTicketSchema),
        ticketsWithCritica: t.Array(exportTicketSchema),
      }),
      detail: {
        summary: 'Get all members and tickets data for export (no pagination/filters)',
        operationId: 'getEventExportData',
      },
    }
  );