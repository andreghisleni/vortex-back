import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';
import { eventSchema } from './schemas';

export const getEventByIdRoute = new Elysia()
  .macro(authMacro)
  .get(
    '/:id',
    async ({ params, set }) => {
      const event = await prisma.event.findUnique({
        where: { id: params.id },
        include: {
          ticketRanges: true,
        }
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
        }, { description: "Event not found" }),
      },
    }
  );
