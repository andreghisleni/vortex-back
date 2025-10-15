import Elysia from 'elysia';
import { createEventRoute } from './create-event-route';
import { getEventByIdRoute } from './get-event-by-id-route';
import { getEventDashboardRoute } from './get-event-dashboard-route';
import { getEventsRoute } from './get-events-route';
import { updateEventRoute } from './update-event-route';

export const events = new Elysia({
  prefix: '/events',
  name: 'Events',
  tags: ['Events'],
})
  .use(createEventRoute)
  .use(getEventsRoute)
  .use(getEventByIdRoute)
  .use(getEventDashboardRoute)
  .use(updateEventRoute);
