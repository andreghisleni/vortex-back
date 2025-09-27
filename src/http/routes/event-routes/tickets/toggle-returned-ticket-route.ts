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
        404: t.Object({
          error: t.String({
            description: 'Error message',
          }),
        }),
      },
      detail: {
        summary: 'Toggle the returned status of a ticket by ID for a specific event',
        operationId: 'toggleReturnedStatusOfEventTicketById',
      },
    }
  );