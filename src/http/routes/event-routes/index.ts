import Elysia from 'elysia';
import { members } from './members';
import { ticketRanges } from './ticket-ranges';

export const event = new Elysia({
  prefix: '/event/:eventId',
  name: 'Event',
  tags: ['Event'],
})
  .use(members)
  .use(ticketRanges);
