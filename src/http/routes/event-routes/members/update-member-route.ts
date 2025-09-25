import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

// Schema para o corpo da atualização (sem alterações)
const updateMemberBodySchema = t.Object({
  sessionId: t.String({ format: 'uuid' }),
  name: t.String(),
  order: t.Optional(t.Number()),
  visionId: t.Optional(t.String()),
  register: t.Optional(t.String()),
});

const memberParamsSchema = t.Object({
  eventId: t.String({ format: 'uuid' }),
  id: t.String({ format: 'uuid' }),
});

export const updateMemberRoute = new Elysia()
  .macro(authMacro)
  .put(
    '/:id',
    async ({ params, body, set }) => {
      try {
        // Atualizamos garantindo o escopo do evento
        // O Prisma vai dar erro se o registro com `id` E `eventId` não for encontrado
        await prisma.member.update({
          where: {
            id: params.id,
            eventId: params.eventId, // Garante que você não atualize um membro de outro evento
          },
          data: {
            ...body,
            cleanName: body.name ? body.name.trim().toLowerCase() : undefined,
          },
          include: {
            tickets: true,
            session: true,
          },
        });
        set.status = 201;
      } catch {
        set.status = 404;
        return { error: 'Member not found in this event' };
      }
    },
    {
      auth: true,
      params: memberParamsSchema,
      body: updateMemberBodySchema,
      response: {
        200: t.Void({
          description: 'Member updated successfully',
        }),
        404: t.Object({
          error: t.String({
            description: 'Error message',
          }),
        }),
      },
      detail: {
        summary: 'Update a member by ID for a specific event',
        operationId: 'updateEventMemberById',
      },
    }
  );