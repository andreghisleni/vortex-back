import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

// Schema para o corpo da requisição
const ticketRangeBodySchema = t.Object({
  start: t.Number(),
  end: t.Number(),
  memberId: t.Optional(t.String({ format: 'uuid' })),
});

// Schema para os parâmetros que incluem eventId
const eventParamsSchema = t.Object({
  eventId: t.String({ format: 'uuid' }),
});

export const createTicketRangeRoute = new Elysia()
  .macro(authMacro)
  .post(
    '/',
    async ({ body, params, set }) => {
      // check if member exists and belongs to event
      if (body.memberId) {
        const member = await prisma.member.findUnique({
          where: { id: body.memberId },
        });

        if (!member || member.eventId !== params.eventId) {
          set.status = 400;
          return { error: 'Member does not belong to the specified event' };
        }
      }
      await prisma.ticketRange.create({
        data: {
          ...body,
          eventId: params.eventId,
        },
      });

      set.status = 201;
    },
    {
      auth: true,
      params: eventParamsSchema,
      body: ticketRangeBodySchema,
      response: {
        201: t.Void({
          description: 'Ticket range created successfully',
        }),
        400: t.Object({
          error: t.String({
            description: 'Error message',
          }),
        }),
      },
      detail: {
        summary: 'Create a new ticket range for a specific event',
        operationId: 'createEventTicketRange',
      },
    }
  );