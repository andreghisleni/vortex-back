import Elysia from 'elysia';
import { createTicketRoute } from './create-ticket-route';
import { deleteTicketRoute } from './delete-ticket-route';
import { getTicketRoute } from './get-ticket-route';
import { getTicketsRoute } from './get-tickets-route';
import { updateTicketRoute } from './update-ticket-route';

export const tickets = new Elysia({
  prefix: '/tickets',
  tags: ['Event - Tickets'],
})
  .use(createTicketRoute)
  .use(getTicketsRoute)
  .use(getTicketRoute)
  .use(updateTicketRoute)
  .use(deleteTicketRoute);
