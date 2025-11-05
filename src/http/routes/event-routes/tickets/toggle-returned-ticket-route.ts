import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

// Schema para os parâmetros que incluem eventId e id
const ticketParamsSchema = t.Object({
  eventId: t.String({ format: 'uuid' }),
  id: t.String({ format: 'uuid' }),
});

export const toggleReturnedTicketRoute = new Elysia()
  .macro(authMacro)
  .put(
    '/:id/toggle-returned',
    async ({ params, set }) => {
      try {
        // Verifica se o evento existe e se está em modo somente leitura
        const event = await prisma.event.findUnique({ where: { id: params.eventId } });
        if (!event) {
          set.status = 404;
          return { error: 'Event not found' };
        }

        if (event.readOnly) {
          set.status = 403;
          return { error: 'Event is read-only' };
        }

        // Verifica se o ticket pertence ao evento correto antes de atualizar
        const existingTicket = await prisma.ticket.findUnique({
          where: { id: params.id },
        });

        if (!existingTicket || existingTicket.eventId !== params.eventId) {
          set.status = 404;
          return { error: 'Ticket not found in this event' };
        }

        await prisma.ticket.update({
          where: { id: params.id },
          data: {
            returned: !existingTicket.returned,
          },
        });
        set.status = 201;
      } catch {
        set.status = 404;
        return { error: 'Ticket not found in this event' };
      }
    },
    {
      auth: true,
      params: ticketParamsSchema,
      response: {
        201: t.Void({
          description: 'Ticket updated successfully',
        }),
        403: t.Object({
          error: t.String({
            description: 'Event is read-only',
          }),
        }, { description: "Event is read-only" }),
        404: t.Object({
          error: t.String({
            description: 'Error message',
          }),
        }, { description: "Ticket not found" }),
      },
      detail: {
        summary: 'Toggle the returned status of a ticket by ID for a specific event',
        operationId: 'toggleReturnedStatusOfEventTicketById',
      },
    }
  );