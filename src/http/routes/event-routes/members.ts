import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

// Schema do modelo Member (sem alterações)
const memberSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  eventId: t.String({ format: 'uuid' }),
  order: t.Nullable(t.Number()),
  visionId: t.Nullable(t.String()),
  name: t.String(),
  cleanName: t.String(),
  register: t.Nullable(t.String()),
  isAllConfirmedButNotYetFullyPaid: t.Boolean(),
  sessionId: t.String({ format: 'uuid' }),
  createdAt: t.Date(),
});

// Schema para o corpo da criação: eventId foi REMOVIDO daqui
const createMemberBodySchema = t.Object({
  sessionId: t.String({ format: 'uuid' }),
  name: t.String(),
  order: t.Optional(t.Number()),
  visionId: t.Optional(t.String()),
  register: t.Optional(t.String()),
});

// Schema para o corpo da atualização (sem alterações)
const updateMemberBodySchema = t.Object({
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

const memberParamsSchema = t.Object({
  eventId: t.String({ format: 'uuid' }),
  id: t.String({ format: 'uuid' }),
});

export const members = new Elysia({
  prefix: '/members', // Este prefixo será adicionado ao prefixo do pai
  name: 'Members-Plugin',
  tags: ['Event - Members'],
})
  .macro(authMacro)
  .get(
    '/',
    async ({ params }) => {
      // Agora filtramos os membros pelo eventId da URL
      return await prisma.member.findMany({
        where: {
          eventId: params.eventId,
        },
      });
    },
    {
      auth: true,
      params: eventParamsSchema, // Usando o schema de parâmetros
      response: t.Array(memberSchema),
      detail: {
        summary: 'Get all members for a specific event',
        operationId: 'getEventMembers',
      },
    }
  )
  .post(
    '/',
    async ({ params, body }) => {
      const cleanName = body.name.trim().toLowerCase();
      // Adicionamos o eventId dos parâmetros da URL aos dados
      return await prisma.member.create({
        data: {
          ...body,
          eventId: params.eventId, // <-- Ponto chave!
          cleanName,
        },
      });
    },
    {
      auth: true,
      params: eventParamsSchema,
      body: createMemberBodySchema,
      response: memberSchema,
      detail: {
        summary: 'Create a new member for a specific event',
        operationId: 'createEventMember',
      },
    }
  )
  .get(
    '/:id',
    async ({ params, set }) => {
      // Buscamos o membro garantindo que ele pertence ao evento correto
      const member = await prisma.member.findUnique({
        where: {
          id: params.id,
          eventId: params.eventId, // Garante segurança e escopo correto
        },
      });

      if (!member) {
        set.status = 404;
        return { error: 'Member not found in this event' };
      }
      return member;
    },
    {
      params: memberParamsSchema,
      response: { 200: memberSchema, 404: t.Object({ error: t.String() }) },
      detail: {
        summary: 'Get a member by ID for a specific event',
        operationId: 'getEventMemberById',
      },
    }
  )
  .put(
    '/:id',
    async ({ params, body, set }) => {
      try {
        // Atualizamos garantindo o escopo do evento
        // O Prisma vai dar erro se o registro com `id` E `eventId` não for encontrado
        return await prisma.member.update({
          where: {
            id: params.id,
            eventId: params.eventId, // Garante que você não atualize um membro de outro evento
          },
          data: {
            ...body,
            cleanName: body.name ? body.name.trim().toLowerCase() : undefined,
          },
        });
      } catch {
        set.status = 404;
        return { error: 'Member not found in this event' };
      }
    },
    {
      auth: true,
      params: memberParamsSchema,
      body: updateMemberBodySchema,
      response: { 200: memberSchema, 404: t.Object({ error: t.String() }) },
      detail: {
        summary: 'Update a member by ID for a specific event',
        operationId: 'updateEventMemberById',
      },
    }
  );
