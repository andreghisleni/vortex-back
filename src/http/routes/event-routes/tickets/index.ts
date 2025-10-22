import Elysia from 'elysia';
import { assignTicketRoute } from './assign-ticket-route';
import { createTicketRoute } from './create-ticket-route';
import { deleteTicketRoute } from './delete-ticket-route';
import { generateTicketsRoute } from './generate-tickets-route';
import { getTicketRoute } from './get-ticket-route';
import { getTicketsRoute } from './get-tickets-route';
import { toggleReturnedTicketRoute } from './toggle-returned-ticket-route';
import { unassignTicketRoute } from './unassign-ticket-route';
import { updateTicketRoute } from './update-ticket-route';

export const tickets = new Elysia({
  prefix: '/tickets',
  tags: ['Event - Tickets'],
})
  .use(createTicketRoute)
  .use(getTicketsRoute)
  .use(getTicketRoute)
  .use(updateTicketRoute)
  .use(deleteTicketRoute)
  .use(toggleReturnedTicketRoute)
  .use(generateTicketsRoute)
  .use(assignTicketRoute)
  .use(unassignTicketRoute);
