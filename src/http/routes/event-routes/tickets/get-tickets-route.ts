import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';
import { sessionTypeSchema } from '../../scout-sessions';

// Schema para o enum TicketCreated
const ticketCreatedSchema = t.Union([
  t.Literal('ONTHELOT'),
  t.Literal('AFTERIMPORT'),
]);

// Schema para o modelo Ticket
const ticketSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  number: t.Number(),
  memberId: t.Nullable(t.String({ format: 'uuid' })),
  member: t.Nullable(t.Object({
    id: t.String({ format: 'uuid' }),
    eventId: t.String({ format: 'uuid' }),
    order: t.Nullable(t.Number()),
    visionId: t.Nullable(t.String()),
    name: t.String(),
    cleanName: t.String(),
    register: t.Nullable(t.String()),
    isAllConfirmedButNotYetFullyPaid: t.Boolean(),
    session: t.Object({
      id: t.String({
        format: 'uuid',
        description: 'Unique identifier for the scout session',
      }),
      name: t.String({
        description: 'Name of the scout session',
        minLength: 3,
      }),
      type: sessionTypeSchema,
      createdAt: t.Date({
        description: 'Timestamp when the session was created',
      }),
      updatedAt: t.Date({
        description: 'Timestamp when the session was last updated',
      }),
    }),
    createdAt: t.Date(),
  })),
  name: t.Nullable(t.String()),
  phone: t.Nullable(t.String()),
  description: t.Nullable(t.String()),
  deliveredAt: t.Nullable(t.Date()),
  returned: t.Boolean(),
  createdAt: t.Date(),
  created: ticketCreatedSchema,
  eventId: t.String({ format: 'uuid' }),
  ticketRangeId: t.Nullable(t.String({ format: 'uuid' })),
});

// Schema para os parâmetros que incluem eventId
const eventParamsSchema = t.Object({
  eventId: t.String({ format: 'uuid' }),
});

export const getTicketsRoute = new Elysia()
  .macro(authMacro)
  .get(
    '/',
    async ({ params }) => {
      return await prisma.ticket.findMany({
        where: { eventId: params.eventId },
        include: {
          member: {
            include: {
              session: true,
            }
          }
        }
      });
    },
    {
      auth: true,
      params: eventParamsSchema,
      response: t.Array(ticketSchema),
      detail: {
        summary: 'Get all tickets for a specific event',
        operationId: 'getAllEventTickets',
      },
    }
  );