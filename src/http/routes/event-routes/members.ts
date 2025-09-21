import Elysia, { t } from "elysia";
import { z } from "zod/v4";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";
import { sessionTypeSchema } from "../scout-sessions";

// Schema do modelo Member (sem alterações)
const memberSchema = t.Object({
  id: t.String({ format: "uuid" }),
  eventId: t.String({ format: "uuid" }),
  order: t.Nullable(t.Number()),
  visionId: t.Nullable(t.String()),
  name: t.String(),
  cleanName: t.String(),
  register: t.Nullable(t.String()),
  isAllConfirmedButNotYetFullyPaid: t.Boolean(),
  session: t.Object({
    id: t.String({
      format: "uuid",
      description: "Unique identifier for the scout session",
    }),
    name: t.String({
      description: "Name of the scout session",
      minLength: 3,
    }),
    type: sessionTypeSchema,
    createdAt: t.Date({
      description: "Timestamp when the session was created",
    }),
    updatedAt: t.Date({
      description: "Timestamp when the session was last updated",
    }),
  }),
  createdAt: t.Date(),
  tickets: t.Array(
    t.Object({
      id: t.String({ format: "uuid" }),
      number: t.Number(),
      memberId: t.Nullable(t.String({ format: "uuid" })),
      name: t.Nullable(t.String()),
      phone: t.Nullable(t.String()),
      description: t.Nullable(t.String()),
      deliveredAt: t.Nullable(t.Date()),
      returned: t.Boolean(),
      createdAt: t.Date(),
      created: t.Union([t.Literal("ONTHELOT"), t.Literal("AFTERIMPORT")]),
      eventId: t.String({ format: "uuid" }),
      ticketRangeId: t.Nullable(t.String({ format: "uuid" })),
    })
  ),
});

// Schema para o corpo da criação: eventId foi REMOVIDO daqui
const createMemberBodySchema = t.Object({
  sessionId: t.String({ format: "uuid" }),
  name: t.String(),
  order: t.Optional(t.Number()),
  visionId: t.Optional(t.String()),
  register: t.Optional(t.String()),
});

// Schema para o corpo da atualização (sem alterações)
const updateMemberBodySchema = t.Object({
  sessionId: t.String({ format: "uuid" }),
  name: t.String(),
  order: t.Optional(t.Number()),
  visionId: t.Optional(t.String()),
  register: t.Optional(t.String()),
});

// Schema para os parâmetros que agora incluem eventId
const eventParamsSchema = t.Object({
  eventId: t.String({ format: "uuid" }),
});

const memberParamsSchema = t.Object({
  eventId: t.String({ format: "uuid" }),
  id: t.String({ format: "uuid" }),
});

export const members = new Elysia({
  prefix: "/members", // Este prefixo será adicionado ao prefixo do pai
  tags: ["Event - Members"],
})
  .macro(authMacro)
  .get(
    "/",
    async ({ params, query }) => {
      const orderBy = [
        query.orderBy?.visionId && { visionId: query.orderBy.visionId },
        query.orderBy?.name && { name: query.orderBy.name },
        query.orderBy?.register && { register: query.orderBy.register },
        query.orderBy?.["session-name"] && {
          session: { name: query.orderBy["session-name"] },
        },
        query.orderBy?.totalTickets && {
          tickets: {
            _count: query.orderBy.totalTickets,
          },
        },

        query.orderBy?.tickets && {
          tickets: {
            _max: { number: query.orderBy.tickets },
          },
        },
      ];
      const [m, total] = await prisma.$transaction([
        prisma.member.findMany({
          where: {
            eventId: params.eventId,
            name: query.filter?.name
              ? {
                  contains: query.filter.name,
                  mode: "insensitive",
                }
              : undefined,
            sessionId: query.filter?.sessionId,
          },
          include: {
            tickets: true,
            session: true,
          },
          take: query.pagination?.pageSize ?? undefined,
          skip:
            ((query.pagination?.page ?? 1) - 1) *
              (query.pagination?.pageSize ?? Number.MAX_SAFE_INTEGER) ||
            undefined,
          orderBy: [...orderBy.filter((o) => o !== undefined)],
        }),
        prisma.member.count({
          where: {
            eventId: params.eventId,
            name: query.filter?.name
              ? {
                  contains: query.filter.name,
                  mode: "insensitive",
                }
              : undefined,
            sessionId: query.filter?.sessionId,
          },
        }),
      ]);

      return {
        data: m,
        meta: {
          total,
          page: query.pagination?.page ?? 1,
          pageSize: query.pagination?.pageSize ?? total,
          totalPages: Math.ceil(
            total / ((query.pagination?.pageSize ?? total) || 1)
          ),
        },
      };
    },
    {
      auth: true,
      params: eventParamsSchema, // Usando o schema de parâmetros
      query: z.object({
        filter: z
          .object(
            {
              name: z
                .string(
                  "Filter by member name (case insensitive, partial match)"
                )
                .optional(),
              sessionId: z
                .uuid("Filter by session ID")
                .describe("Filter by session ID")
                .optional(),
            },
            "Query parameters for filtering members"
          )
          .optional(),
        pagination: z
          .object(
            {
              page: z.number("Page number").min(1).default(1).optional(),
              pageSize: z
                .number("Page size")
                .min(1)
                .max(100)
                .default(20)
                .optional(),
            },
            "Pagination parameters"
          )
          .optional(),
        orderBy: z
          .object(
            {
              visionId: z.enum(["asc", "desc"], "Order direction").optional(),
              name: z.enum(["asc", "desc"], "Order direction").optional(),
              register: z.enum(["asc", "desc"], "Order direction").optional(),
              "session-name": z
                .enum(["asc", "desc"], "Order direction")
                .optional(),
              totalTickets: z
                .enum(["asc", "desc"], "Order direction")
                .optional(),
              tickets: z.enum(["asc", "desc"], "Order direction").optional(),
            },
            "Ordering parameters"
          )
          .optional(),
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
        summary: "Get all members for a specific event",
        operationId: "getEventMembers",
      },
    }
  )
  .post(
    "/",
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
        summary: "Create a new member for a specific event",
        operationId: "createEventMember",
      },
    }
  )
  .get(
    "/:id",
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
        return { error: "Member not found in this event" };
      }
      return member;
    },
    {
      params: memberParamsSchema,
      response: {
        200: memberSchema,
        404: t.Object({
          error: t.String({
            description: "Error message",
          }),
        }),
      },
      detail: {
        summary: "Get a member by ID for a specific event",
        operationId: "getEventMemberById",
      },
    }
  )
  .put(
    "/:id",
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
        return { error: "Member not found in this event" };
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
            description: "Error message",
          }),
        }),
      },
      detail: {
        summary: "Update a member by ID for a specific event",
        operationId: "updateEventMemberById",
      },
    }
  );
