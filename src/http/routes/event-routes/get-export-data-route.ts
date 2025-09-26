import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

// Schema para o modelo Member na exportação (apenas campos necessários)
const exportMemberSchema = t.Object({
  visionId: t.Nullable(t.String()),
  name: t.String(),
  session: t.Object({
    name: t.String(),
  }),
  tickets: t.Array(
    t.Object({
      number: t.Number(),
      deliveredAt: t.Nullable(t.Date()),
      returned: t.Boolean(),
    })
  ),
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
      // Buscar membros que têm tickets não entregues/não devolvidos (apenas campos necessários)
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
            select: {
              number: true,
              deliveredAt: true,
              returned: true,
            }
          },
        },
        orderBy: [
          { session: { name: 'asc' } },
          { name: 'asc' },
        ],
      });

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
        // Membros com tickets pendentes (equivale ao filtro JS atual)
        members: membersWithPendingTickets,
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