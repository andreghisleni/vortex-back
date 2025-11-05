import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

export const updateEventRoute = new Elysia().macro(authMacro).put(
  '/:id',
  async ({ params, body, set }) => {
    try {

      await prisma.event.update({
        where: { id: params.id },
        data: body,
      });

      set.status = 201;

    } catch {
      set.status = 404;
      return { error: 'Event not found' };
    }
  },
  {
    auth: true,
    params: t.Object({ id: t.String({ format: 'uuid' }) }),
    body: t.Object({
      name: t.String({ minLength: 3 }),
      description: t.Nullable(t.String()),
      autoGenerateTicketsTotalPerMember: t.Optional(t.Number()),
      readOnly: t.Optional(t.Boolean()),
    }),
    response: {
      201: t.Void({ description: "Event updated successfully" }),
      404: t.Object({ error: t.String() }, { description: "Event not found" }),
    },
    detail: {
      tags: ['Events'],
      summary: 'Update an event by ID',
      operationId: 'updateEventById',
    },
  }
);
