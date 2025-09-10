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
  name: 'Tickets',
  tags: ['Tickets'],
})
  .macro(authMacro)
  .get(
    '/',
    async () => {
      return await prisma.ticket.findMany();
    },
    {
      auth: true,
      detail: { summary: 'Get all tickets' },
      response: t.Array(ticketSchema),
    }
  )
  .post(
    '/',
    async ({ body }) => {
      return await prisma.ticket.create({ data: body });
    },
    {
      auth: true,
      body: ticketBodySchema,
      response: ticketSchema,
      detail: { summary: 'Create a new ticket' },
    }
  )
  .get(
    '/:id',
    async ({ params, set }) => {
      const ticket = await prisma.ticket.findUnique({
        where: { id: params.id },
      });
      if (!ticket) {
        set.status = 404;
        return { error: 'Ticket not found' };
      }
      return ticket;
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: { 200: ticketSchema, 404: t.Object({ error: t.String() }) },
      detail: { summary: 'Get a ticket by ID' },
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
      } catch (e) {
        set.status = 404;
        return { error: 'Ticket not found' };
      }
    },
    {
      auth: true,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      body: t.Partial(ticketBodySchema),
      response: { 200: ticketSchema, 404: t.Object({ error: t.String() }) },
      detail: { summary: 'Update a ticket by ID' },
    }
  )
  .delete(
    '/:id',
    async ({ params, set }) => {
      try {
        await prisma.ticket.delete({ where: { id: params.id } });
        set.status = 204;
      } catch (e) {
        set.status = 404;
        return { error: 'Ticket not found' };
      }
    },
    {
      auth: true,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: { 204: t.Void(), 404: t.Object({ error: t.String() }) },
      detail: { summary: 'Delete a ticket by ID' },
    }
  );
