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

// Schema para o corpo da requisição
const ticketRangeBodySchema = t.Object({
  start: t.Number(),
  end: t.Number(),
  eventId: t.String({ format: 'uuid' }),
  memberId: t.Optional(t.String({ format: 'uuid' })),
});

// Schema para os parâmetros que agora incluem eventId
const eventParamsSchema = t.Object({
  eventId: t.String({ format: 'uuid' }),
});

export const ticketRanges = new Elysia({
  prefix: '/ticket-ranges',
  name: 'Ticket Ranges',
  tags: ['Event - Ticket Ranges'],
})
  .macro(authMacro)
  .get(
    '/',
    async ({ params }) => {
      return await prisma.ticketRange.findMany({
        where: { deletedAt: null, eventId: params.eventId },
      });
    },
    {
      auth: true,
      detail: {
        summary: 'Get all active ticket ranges',
        operationId: 'getAllEventTicketRanges',
      },
      response: t.Array(ticketRangeSchema),
      params: eventParamsSchema,
    }
  )
  .post(
    '/',
    async ({ body, params }) => {
      return await prisma.ticketRange.create({
        data: { ...body, eventId: params.eventId },
      });
    },
    {
      auth: true,
      body: ticketRangeBodySchema,
      response: ticketRangeSchema,
      detail: {
        summary: 'Create a new ticket range',
        operationId: 'createEventTicketRange',
      },
      params: eventParamsSchema,
    }
  )
  .get(
    '/:id',
    async ({ params, set }) => {
      const range = await prisma.ticketRange.findUnique({
        where: { id: params.id },
      });
      if (!range || range.deletedAt) {
        set.status = 404;
        return { error: 'Ticket range not found' };
      }
      return range;
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: {
        200: ticketRangeSchema,
        404: t.Object({
          error: t.String({
            description: 'Error message',
          }),
        }),
      },
      detail: {
        summary: 'Get a ticket range by ID',
        operationId: 'getTicketRangeById',
      },
    }
  )
  .put(
    '/:id',
    async ({ params, body, set }) => {
      try {
        return await prisma.ticketRange.update({
          where: { id: params.id, eventId: params.eventId },
          data: body,
        });
      } catch {
        set.status = 404;
        return { error: 'Ticket range not found' };
      }
    },
    {
      auth: true,
      params: t.Object({
        id: t.String({ format: 'uuid' }),
        eventId: t.String({ format: 'uuid' }),
      }),
      body: t.Partial(ticketRangeBodySchema),
      response: {
        200: ticketRangeSchema,
        404: t.Object({
          error: t.String({
            description: 'Error message',
          }),
        }),
      },
      detail: {
        summary: 'Update a ticket range by ID',
        operationId: 'updateTicketRangeById',
      },
    }
  );
// .delete(
//   '/:id',
//   async ({ params, set }) => {
//     try {
//       await prisma.ticketRange.update({
//         where: { id: params.id },
//         data: { deletedAt: new Date() },
//       });
//       set.status = 204;
//     } catch {
//       set.status = 404;
//       return { error: 'Ticket range not found' };
//     }
//   },
//   {
//     auth: true,
//     params: t.Object({ id: t.String({ format: 'uuid' }) }),
//     response: { 204: t.Void(), 404: t.Object({
// error: t.String({
//   description: 'Error message'
// })
//         }) },
//     detail: { summary: 'Soft delete a ticket range by ID' },
//   }
// );
