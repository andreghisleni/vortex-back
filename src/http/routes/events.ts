import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

const ticketTypeSchema = t.Union([t.Literal('SINGLE_NUMERATION'), t.Literal('MULTIPLE_NUMERATIONS')], {
  default: 'SINGLE_NUMERATION',
  description: 'Type of ticketing system used for the event',
});

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
  ticketType: ticketTypeSchema,
  ownerId: t.Nullable(t.String({
    format: 'uuid',
    description: 'Unique identifier for the owner of the event',
  })),
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
    async () => {
      const e = await prisma.event.findMany();

      return e;
    },
    {
      auth: true,
      detail: {
        tags: ['Events'],
        summary: 'Get all events',
        operationId: 'getAllEvents'
      },
      response: {
        200: t.Array(eventSchema)
      }
    }
  )
  .post(
    '/',
    async ({ user, body }) => {
      const event = await prisma.event.create({
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
        operationId: 'createEvent',
      },
      auth: true,
      body: t.Object({
        name: t.String({
          minLength: 3,
          description: 'Name of the event',
        }),
        description: t.Nullable(t.String({
          maxLength: 500,
          description: 'Description of the event',
        })),
        ticketType: ticketTypeSchema,
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
        operationId: 'getEventById',
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
