import Elysia from 'elysia';
import { createTicketRangeRoute } from './create-ticket-range-route';
import { getTicketRangeRoute } from './get-ticket-range-route';
import { getTicketRangesRoute } from './get-ticket-ranges-route';
import { updateTicketRangeRoute } from './update-ticket-range-route';

export const ticketRanges = new Elysia({
  prefix: '/ticket-ranges',
  name: 'Ticket Ranges',
  tags: ['Event - Ticket Ranges'],
})
  .use(createTicketRangeRoute)
  .use(getTicketRangesRoute)
  .use(getTicketRangeRoute)
  .use(updateTicketRangeRoute);