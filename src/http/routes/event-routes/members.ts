import type { Prisma } from '@prisma/client';
import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';
import { sessionTypeSchema } from '../scout-sessions';

export const orderTypeSchema = t.Union([t.Literal('asc'), t.Literal('desc')], {
  description: 'Type of the order',
});

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
  session: t.Object({
    id: t.String({
      format: 'uuid',
      description: 'Unique identifier for the scout session',
    }),
    name: t.String({
      description: 'Name of the scout session',
      minLength: 3,
    }),
    type: sessionTypeSchema,
    createdAt: t.Date({
      description: 'Timestamp when the session was created',
    }),
    updatedAt: t.Date({
      description: 'Timestamp when the session was last updated',
    }),
  }),
  createdAt: t.Date(),
  tickets: t.Array(
    t.Object({
      id: t.String({ format: 'uuid' }),
      number: t.Number(),
      memberId: t.Nullable(t.String({ format: 'uuid' })),
      name: t.Nullable(t.String()),
      phone: t.Nullable(t.String()),
      description: t.Nullable(t.String()),
      deliveredAt: t.Nullable(t.Date()),
      returned: t.Boolean(),
      createdAt: t.Date(),
      created: t.Union([t.Literal('ONTHELOT'), t.Literal('AFTERIMPORT')]),
      eventId: t.String({ format: 'uuid' }),
      ticketRangeId: t.Nullable(t.String({ format: 'uuid' })),
    })
  ),
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
  tags: ['Event - Members'],
})
  .macro(authMacro)
  .get(
    '/',
    async ({ params, query }) => {
      const orderBy = [
        query?.['ob.visionId'] && { visionId: query?.['ob.visionId'] },
        query?.['ob.name'] && { name: query?.['ob.name'] },
        query?.['ob.register'] && { register: query?.['ob.register'] },
        query?.['ob.session-name'] && {
          session: { name: query?.['ob.session-name'] },
        },
        query?.['ob.totalTickets'] && {
          tickets: {
            _count: query?.['ob.totalTickets'],
          },
        },

        query?.['ob.tickets'] && {
          tickets: {
            _max: { number: query?.['ob.tickets'] },
          },
        },
      ];

      const or = [
        {
          visionId: {
            contains: query?.['f.filter'],
            mode: 'insensitive',
          },
        },
        {
          name: {
            contains: query?.['f.filter'],
            mode: 'insensitive',
          },
        },
        {
          register: {
            contains: query?.['f.filter'],
            mode: 'insensitive',
          },
        },
        {
          tickets: Number.isNaN(Number.parseInt(query['f.filter'], 10))
            ? undefined
            : {
              some: {
                number: {
                  equals: Number.parseInt(query['f.filter'], 10),
                },
              },
            },
        },
        {},
      ] satisfies Prisma.MemberWhereInput[];

      const [m, total] = await prisma.$transaction([
        prisma.member.findMany({
          where: {
            eventId: params.eventId,
            sessionId: query?.['f.sessionId'],
            OR: query?.['f.filter'] ? or : undefined,
          },
          include: {
            tickets: true,
            session: true,
          },
          take: query?.['p.pageSize'] ?? 20,
          skip:
            ((query?.['p.page'] ?? 1) - 1) * (query?.['p.pageSize'] ?? 20) ||
            undefined,
          orderBy: [...orderBy.filter((o) => o !== undefined)],
        }),
        prisma.member.count({
          where: {
            eventId: params.eventId,
            sessionId: query?.['f.sessionId'],
            OR: query?.['f.filter'] ? or : undefined,
          },
        }),
      ]);

      return {
        data: m,
        meta: {
          total,
          page: query.p?.page ?? 1,
          pageSize: query.p?.pageSize ?? 10,
          totalPages: Math.ceil(total / ((query.p?.pageSize ?? 10) || 1)),
        },
      };
    },
    {
      auth: true,
      params: eventParamsSchema, // Usando o schema de parâmetros
      query: t.Object({
        'f.filter': t.Optional(
          t.String({
            description:
              'Filter by member filter on visionId, name register, or tickets',
          })
        ),
        'f.sessionId': t.Optional(
          t.String({
            description: 'Filter by session ID',
          })
        ),
        'p.page': t.Optional(
          t.Number({
            description: 'Page number',
            default: 1,
          })
        ),
        'p.pageSize': t.Optional(
          t.Number({
            description: 'Page size',
            default: 20,
          })
        ),
        'ob.visionId': t.Optional(orderTypeSchema),
        'ob.name': t.Optional(orderTypeSchema),
        'ob.register': t.Optional(orderTypeSchema),
        'ob.totalTickets': t.Optional(orderTypeSchema),
        'ob.tickets': t.Optional(orderTypeSchema),
        'ob.session-name': t.Optional(orderTypeSchema),
      }),
      response: t.Object({
        data: t.Array(memberSchema),
        meta: t.Object({
          total: t.Number(),
          page: t.Number(),
          pageSize: t.Number(),
          totalPages: t.Number(),
        }),
      }),
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
        include: {
          tickets: true,
          session: true,
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
        include: {
          tickets: true,
          session: true,
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
      response: {
        200: memberSchema,
        404: t.Object({
          error: t.String({
            description: 'Error message',
          }),
        }),
      },
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
          include: {
            tickets: true,
            session: true,
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
      response: {
        200: memberSchema,
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
