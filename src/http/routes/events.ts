import { EventTicketType } from '@prisma/client';
import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

const eventSchema = t.Object({
  id: t.String({
    format: 'uuid',
    description: 'Unique identifier for the event',
  }),
  name: t.String({
    description: 'Name of the event',
    minLength: 3,
  }),
  description: t.Nullable(t.String({
    description: 'Description of the event',
    maxLength: 500,
  })),
  ticketType: t.Enum(EventTicketType, {
    default: EventTicketType.SINGLE_NUMERATION,
    description: 'Type of ticketing system used for the event',
  }),
  ownerId: t.String({
    format: 'uuid',
    description: 'Unique identifier for the owner of the event',
  }),
  createdAt: t.Date({
    description: 'Timestamp when the event was created',
  }),
  updatedAt: t.Date({
    description: 'Timestamp when the event was last updated',
  })
});

export const events = new Elysia({
  prefix: '/events',
  name: 'Events',
  tags: ['Events'],

})
  .macro(authMacro)
  .get(
    '/',
    ({ user }) => {
      // biome-ignore lint/suspicious/noConsole: <explanation>
      console.log(user);
      return 'Events API';
    },
    { auth: true }
  )
  .post(
    '/',
    async ({ user, body, db }) => {
      const event = await db.event.create({
        data: {
          ...body,
          ownerId: user.id
        }
      });
      return event;
    },
    {
      detail: {
        tags: ['Events'],
        summary: 'Create a new event',
      },
      auth: true,
      body: t.Object({
        name: t.String({
          minLength: 3,
        }),
        description: t.String({
          maxLength: 500
        }),
        ticketType: t.Enum(EventTicketType)
      }),
      response: {
        200: eventSchema,
        404: t.Object({
          error: t.String(),
        })
      }
    }
  )
  .get(
    '/:id',
    async ({ params, set }) => {
      const event = await prisma.event.findUnique({
        where: { id: params.id },
      });
      if (!event) {
        set.status = 404;
        return {
          error: 'Event not found',
        };
      }
      return event;
    },
    {
      detail: {
        tags: ['Events'],
        summary: 'Get event by ID',
      },
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      response: {
        200: eventSchema,
        404: t.Object({
          error: t.String(),
        }),
      },
    }
  );
