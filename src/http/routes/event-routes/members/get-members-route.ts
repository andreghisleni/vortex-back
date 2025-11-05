import type { Prisma } from "@prisma/client";
import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";
import { sessionTypeSchema } from "../../scout-sessions";
import { paymentTypeSchema } from "../payments/get-payment-route";

export const orderTypeSchema = t.Union([t.Literal("asc"), t.Literal("desc")], {
  description: "Type of the order",
});

// Schema do modelo Member (sem alterações)
const memberSchema = t.Object(
  {
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
      t.Object(
        {
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
        },
        {
          description: "Ticket details associated with the member",
        }
      )
    ),

    ticketAllocations: t.Array(
      t.Object(
        {
          id: t.String({ format: "uuid" }),
          eventTicketRangeId: t.String({ format: "uuid" }),
          quantity: t.Number(),
        },
        {
          description: "Ticket allocation details associated with the member",
        }
      )
    ),
    payments: t.Array(
      t.Object(
        {
          id: t.String({ format: "uuid" }),
          visionId: t.Nullable(t.String()),
          amount: t.Number(),
          type: paymentTypeSchema,
          payedAt: t.Date(),
          memberId: t.String({ format: "uuid" }),
          createdAt: t.Date(),
          updatedAt: t.Date(),
          deletedAt: t.Nullable(t.Date()),
          deletedBy: t.Nullable(t.String()),
        },
        {
          description: "Payment details associated with the member",
        }
      )
    ),
  },
  {
    description:
      "Schema representing a member with tickets, ticket allocations, and payments",
  }
);

// Schema para os parâmetros que agora incluem eventId
const eventParamsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
  },
  {
    description: "Schema for event parameters including eventId",
  }
);

export const getMembersRoute = new Elysia().macro(authMacro).get(
  "/",
  async ({ params, query }) => {
    const orderBy = [
      query?.["ob.visionId"] && { visionId: query?.["ob.visionId"] },
      query?.["ob.name"] && { name: query?.["ob.name"] },
      query?.["ob.register"] && { register: query?.["ob.register"] },
      query?.["ob.session-name"] && {
        session: { name: query?.["ob.session-name"] },
      },
      query?.["ob.totalTickets"] && {
        tickets: {
          _count: query?.["ob.totalTickets"],
        },
      },

      query?.["ob.tickets"] && {
        tickets: {
          _max: { number: query?.["ob.tickets"] },
        },
      },
      query?.["ob.order"] ? { order: query?.["ob.order"] } : { order: "asc" },
    ];

    const or = [
      {
        visionId: {
          contains: query?.["f.filter"],
          mode: "insensitive",
        },
      },
      {
        name: {
          contains: query?.["f.filter"],
          mode: "insensitive",
        },
      },
      {
        register: {
          contains: query?.["f.filter"],
          mode: "insensitive",
        },
      },
      {
        tickets: Number.isNaN(Number.parseInt(query["f.filter"], 10))
          ? undefined
          : {
              some: {
                number: {
                  equals: Number.parseInt(query["f.filter"], 10),
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
          sessionId: query?.["f.sessionId"],
          OR: query?.["f.filter"] ? or : undefined,
        },
        include: {
          tickets: true,
          session: true,
          ticketAllocations: true,
          payments: {
            where: {
              deletedAt: null,
            },
          },
        },
        take: query?.["p.pageSize"] ?? 20,
        skip:
          ((query?.["p.page"] ?? 1) - 1) * (query?.["p.pageSize"] ?? 20) ||
          undefined,
        orderBy: [...orderBy.filter((o) => o !== undefined)],
      }),
      prisma.member.count({
        where: {
          eventId: params.eventId,
          sessionId: query?.["f.sessionId"],
          OR: query?.["f.filter"] ? or : undefined,
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
      "f.filter": t.Optional(
        t.String({
          description:
            "Filter by member filter on visionId, name register, or tickets",
        })
      ),
      "f.sessionId": t.Optional(
        t.String({
          description: "Filter by session ID",
        })
      ),
      "p.page": t.Optional(
        t.Number({
          description: "Page number",
          default: 1,
        })
      ),
      "p.pageSize": t.Optional(
        t.Number({
          description: "Page size",
          default: 20,
        })
      ),
      "ob.order": t.Optional(orderTypeSchema),
      "ob.visionId": t.Optional(orderTypeSchema),
      "ob.name": t.Optional(orderTypeSchema),
      "ob.register": t.Optional(orderTypeSchema),
      "ob.totalTickets": t.Optional(orderTypeSchema),
      "ob.tickets": t.Optional(orderTypeSchema),
      "ob.session-name": t.Optional(orderTypeSchema),
    }),
    response: {
      200: t.Object(
        {
          data: t.Array(memberSchema),
          meta: t.Object({
            total: t.Number(),
            page: t.Number(),
            pageSize: t.Number(),
            totalPages: t.Number(),
          }),
        },
        { description: "Paginated list of event members" }
      ),
    },
    detail: {
      summary: "Get all members for a specific event",
      operationId: "getEventMembers",
    },
  }
);
