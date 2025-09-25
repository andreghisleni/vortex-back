import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

// Schema para o corpo da criação
const createMemberBodySchema = t.Object({
  sessionId: t.String({ format: 'uuid' }),
  name: t.String(),
  order: t.Optional(t.Number()),
  visionId: t.Optional(t.String()),
  register: t.Optional(t.String()),
});


// Schema para os parâmetros que agora incluem eventId
const eventParamsSchema = t.Object({
  eventId: t.String({ format: 'uuid' }),
});

export const createMemberRoute = new Elysia()
  .macro(authMacro)
  .post(
    '/',
    async ({ params, body, set }) => {
      const cleanName = body.name.trim().toLowerCase();
      // Adicionamos o eventId dos parâmetros da URL aos dados
      await prisma.member.create({
        data: {
          ...body,
          eventId: params.eventId, // <-- Ponto chave!
          cleanName,
        },
      });

      set.status = 201;
    },
    {
      auth: true,
      params: eventParamsSchema,
      body: createMemberBodySchema,
      response: {
        201: t.Void({
          description: 'Member created successfully',
        })
      },
      detail: {
        summary: 'Create a new member for a specific event',
        operationId: 'createEventMember',
      },
    }
  );
