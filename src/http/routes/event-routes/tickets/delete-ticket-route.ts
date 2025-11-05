import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";

// import { prisma } from "~/db/client";

// Schema para os parâmetros que incluem eventId e id
const ticketParamsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
    id: t.String({ format: "uuid" }),
  },
  {
    description: "Parameters including eventId and ticket id",
  }
);

export const deleteTicketRoute = new Elysia().macro(authMacro).delete(
  "/:id",
  ({ set }) => {
    set.status = 400;
    return { error: "You can`t delete a ticket" };

    // const event = await prisma.event.findUnique({ where: { id: params.eventId } });
    // if (!event) {
    //   set.status = 404;
    //   return { error: 'Event not found' };
    // }
    // if (event.readOnly) {
    //   set.status = 403;
    //   return { error: 'Event is read-only' };
    // }
    // try {
    //   // Verifica se o ticket pertence ao evento correto antes de deletar
    //   const existingTicket = await prisma.ticket.findUnique({
    //     where: { id: params.id },
    //   });

    //   if (!existingTicket || existingTicket.eventId !== params.eventId) {
    //     set.status = 404;
    //     return { error: 'Ticket not found in this event' };
    //   }

    //   await prisma.ticket.delete({
    //     where: { id: params.id, eventId: params.eventId },
    //   });

    //   set.status = 204;
    // } catch {
    //   set.status = 404;
    //   return { error: 'Ticket not found in this event' };
    // }
  },
  {
    auth: true,
    params: ticketParamsSchema,
    response: {
      204: t.Void(),
      404: t.Object(
        {
          error: t.String({
            description: "Error message",
          }),
        },
        {
          description: "Ticket not found in this event",
        }
      ),
    },
    detail: {
      summary: "Delete a ticket by ID for a specific event",
      operationId: "deleteEventTicketById",
    },
  }
);
