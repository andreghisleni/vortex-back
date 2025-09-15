import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

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

// Schema para o corpo da requisição
const ticketBodySchema = t.Object({
  number: t.Number(),
  eventId: t.String({ format: 'uuid' }),
  memberId: t.Optional(t.String({ format: 'uuid' })),
  name: t.Optional(t.String()),
  phone: t.Optional(t.String()),
  description: t.Optional(t.String()),
  deliveredAt: t.Optional(t.Date()),
  returned: t.Optional(t.Boolean()),
  created: t.Optional(ticketCreatedSchema),
  ticketRangeId: t.Optional(t.String({ format: 'uuid' })),
});

export const tickets = new Elysia({
  prefix: '/tickets',
  tags: ['Event - Tickets'],
})
  .macro(authMacro)
  .get(
    '/',
    async ({ params }) => {
      return await prisma.ticket.findMany({
        where: { eventId: params.eventId },
      });
    },
    {
      auth: true,
      detail: {
        summary: 'Get all tickets',
        operationId: 'getAllEventTickets',
      },
      response: t.Array(ticketSchema),
      params: t.Object({
        eventId: t.String({ format: 'uuid' }),
      }),
    }
  )
  .post(
    '/',
    async ({ body, params }) => {
      return await prisma.ticket.create({
        data: { ...body, eventId: params.eventId },
      });
    },
    {
      auth: true,
      body: ticketBodySchema,
      response: ticketSchema,
      detail: {
        summary: 'Create a new ticket',
        operationId: 'createEventTicket',
      },
      params: t.Object({
        eventId: t.String({ format: 'uuid' }),
      }),
    }
  )
  .get(
    '/:id',
    async ({ params, set }) => {
      const ticket = await prisma.ticket.findUnique({
        where: { id: params.id },
      });
      if (!ticket || ticket.eventId !== params.eventId) {
        set.status = 404;
        return { error: 'Ticket not found' };
      }
      return ticket;
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
        eventId: t.String({ format: 'uuid' }),
      }),
      response: {
        200: ticketSchema,
        404: t.Object({
          error: t.String({
            description: 'Error message',
          }),
        }),
      },
      detail: {
        summary: 'Get a ticket by ID',
        operationId: 'getEventTicketById',
      },
    }
  )
  .put(
    '/:id',
    async ({ params, body, set }) => {
      try {
        return await prisma.ticket.update({
          where: { id: params.id },
          data: body,
        });
      } catch {
        set.status = 404;
        return { error: 'Ticket not found' };
      }
    },
    {
      auth: true,
      params: t.Object({
        id: t.String({ format: 'uuid' }),
        eventId: t.String({ format: 'uuid' }),
      }),
      body: t.Partial(ticketBodySchema),
      response: {
        200: ticketSchema,
        404: t.Object({
          error: t.String({
            description: 'Error message',
          }),
        }),
      },
      detail: {
        summary: 'Update a ticket by ID',
        operationId: 'updateEventTicketById',
      },
    }
  )
  .delete(
    '/:id',
    async ({ params, set }) => {
      try {
        await prisma.ticket.delete({
          where: { id: params.id, eventId: params.eventId },
        });
        set.status = 204;
      } catch {
        set.status = 404;
        return { error: 'Ticket not found' };
      }
    },
    {
      auth: true,
      params: t.Object({
        id: t.String({ format: 'uuid' }),
        eventId: t.String({ format: 'uuid' }),
      }),
      response: {
        204: t.Void(),
        404: t.Object({
          error: t.String({
            description: 'Error message',
          }),
        }),
      },
      detail: {
        summary: 'Delete a ticket by ID',
        operationId: 'deleteEventTicketById',
      },
    }
  );
