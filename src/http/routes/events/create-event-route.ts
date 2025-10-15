import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';
import { eventSchema, ticketTypeSchema } from './schemas';

export const createEventRoute = new Elysia().macro(authMacro).post(
  '/',
  async ({ user, body: { ticketRanges, ...body } }) => {
    const event = await prisma.event.create({
      data: {
        ...body,
        ownerId: user.id,
        ticketRanges: {
          createMany: {
            data: ticketRanges,
            skipDuplicates: true,
          },
        },
      },
      include: {
        ticketRanges: true,
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
      description: t.Nullable(
        t.String({
          maxLength: 500,
          description: 'Description of the event',
        })
      ),
      autoGenerateTicketsTotalPerMember: t.Optional(t.Number()),
      readOnly: t.Optional(t.Boolean()),
      ticketType: ticketTypeSchema,
      ticketRanges: t.Array(
        t.Object({
          start: t.Number(),
          end: t.Number(),
          type: t.String(),
        }),
        {
          description: 'The ticket ranges for the event',
          default: [],
        }
      ),
    }),
    response: {
      200: eventSchema,
      404: t.Object({
        error: t.String(),
      }),
    },
  }
);
