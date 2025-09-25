import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

// Schema para o modelo TicketRange
const ticketRangeSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  start: t.Number(),
  end: t.Number(),
  memberId: t.Nullable(t.String({ format: 'uuid' })),
  generatedAt: t.Nullable(t.Date()),
  eventId: t.String({ format: 'uuid' }),
  createdAt: t.Date(),
  deletedAt: t.Nullable(t.Date()),
});

// Schema para os parâmetros que incluem eventId
const eventParamsSchema = t.Object({
  eventId: t.String({ format: 'uuid' }),
});

export const getTicketRangesRoute = new Elysia()
  .macro(authMacro)
  .get(
    '/',
    async ({ params }) => {
      return await prisma.ticketRange.findMany({
        where: {
          deletedAt: null,
          eventId: params.eventId,
        },
      });
    },
    {
      auth: true,
      params: eventParamsSchema,
      response: t.Array(ticketRangeSchema),
      detail: {
        summary: 'Get all active ticket ranges for a specific event',
        operationId: 'getAllEventTicketRanges',
      },
    }
  );