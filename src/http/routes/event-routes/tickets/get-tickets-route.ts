import type { Prisma } from "@prisma/client";
import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";
import { sessionTypeSchema } from "../../scout-sessions";

export const orderTypeSchema = t.Union([t.Literal("asc"), t.Literal("desc")], {
  description: "Type of the order",
});

// Schema para o enum TicketCreated
const ticketCreatedSchema = t.Union([
  t.Literal("ONTHELOT"),
  t.Literal("AFTERIMPORT"),
]);

// Schema para o modelo Ticket
const ticketSchema = t.Object(
  {
    id: t.String({ format: "uuid" }),
    number: t.Number(),
    memberId: t.Nullable(t.String({ format: "uuid" })),
    member: t.Nullable(
      t.Object(
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
        },
        {
          description: "Member associated with the ticket",
        }
      )
    ),
    name: t.Nullable(t.String()),
    phone: t.Nullable(t.String()),
    description: t.Nullable(t.String()),
    deliveredAt: t.Nullable(t.Date()),
    returned: t.Boolean(),
    createdAt: t.Date(),
    created: ticketCreatedSchema,
    eventId: t.String({ format: "uuid" }),
    ticketRangeId: t.Nullable(t.String({ format: "uuid" })),
  },
  {
    description: "Ticket model schema",
  }
);

// Schema para os parâmetros que incluem eventId
const eventParamsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
  },
  {
    description: "Parameters including eventId",
  }
);

export const getTicketsRoute = new Elysia().macro(authMacro).get(
  "/",
  async ({ params, query }) => {
    const orderBy = [
      query?.["ob.member.name"] && {
        member: { name: query?.["ob.member.name"] },
      },
      query?.["ob.deliveredAt"] && { deliveredAt: query?.["ob.deliveredAt"] },
      query?.["ob.returned"] && { returned: query?.["ob.returned"] },
      query?.["ob.createdAt"] && { createdAt: query?.["ob.createdAt"] },
      query?.["ob.number"]
        ? { number: query?.["ob.number"] }
        : { number: "asc" },
    ];

    const orFilters: Prisma.TicketWhereInput[] = [
      {
        name: {
          contains: query?.["f.filter"],
          mode: "insensitive",
        },
      },
      {
        phone: {
          contains: query?.["f.filter"],
          mode: "insensitive",
        },
      },
      {
        description: {
          contains: query?.["f.filter"],
          mode: "insensitive",
        },
      },
      {
        member: {
          name: {
            contains: query?.["f.filter"],
            mode: "insensitive",
          },
        },
      },
    ];

    if (!Number.isNaN(Number.parseInt(query?.["f.filter"] || "", 10))) {
      orFilters.push({
        number: {
          equals: Number.parseInt(query?.["f.filter"] || "", 10),
        },
      });
    }

    const [tickets, total] = await prisma.$transaction([
      prisma.ticket.findMany({
        where: {
          eventId: params.eventId,
          memberId: query?.["f.noMemberId"] ? null : query?.["f.memberId"],
          returned:
            query?.["f.returned"] !== undefined
              ? query?.["f.returned"] === "true"
              : undefined,
          OR: query?.["f.filter"] ? orFilters : undefined,
        },
        include: {
          member: {
            include: {
              session: true,
            },
          },
        },
        take: query?.["p.pageSize"] ?? 20,
        skip:
          ((query?.["p.page"] ?? 1) - 1) * (query?.["p.pageSize"] ?? 20) ||
          undefined,
        orderBy: [...orderBy.filter((o) => o !== undefined)],
      }),
      prisma.ticket.count({
        where: {
          eventId: params.eventId,
          memberId: query?.["f.noMemberId"] ? null : query?.["f.memberId"],
          returned:
            query?.["f.returned"] !== undefined
              ? query?.["f.returned"] === "true"
              : undefined,
          OR: query?.["f.filter"] ? orFilters : undefined,
        },
      }),
    ]);

    return {
      data: tickets,
      meta: {
        total,
        page: query?.["p.page"] ?? 1,
        pageSize: query?.["p.pageSize"] ?? 20,
        totalPages: Math.ceil(total / ((query?.["p.pageSize"] ?? 20) || 1)),
      },
    };
  },
  {
    auth: true,
    params: eventParamsSchema,
    query: t.Object({
      "f.filter": t.Optional(
        t.String({
          description:
            "Filter by ticket number, name, phone, description, or member name",
        })
      ),
      "f.memberId": t.Optional(
        t.Nullable(
          t.String({
            description: "Filter by member ID",
            format: "uuid",
          })
        )
      ),
      "f.noMemberId": t.Optional(
        t.Boolean({
          description: "Filter has no member ID",
        })
      ),
      "f.returned": t.Optional(
        t.String({
          description: "Filter by returned status (true/false)",
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
      "ob.number": t.Optional(orderTypeSchema),
      "ob.member.name": t.Optional(orderTypeSchema),
      "ob.deliveredAt": t.Optional(orderTypeSchema),
      "ob.returned": t.Optional(orderTypeSchema),
      "ob.createdAt": t.Optional(orderTypeSchema),
    }),
    response: t.Object(
      {
        data: t.Array(ticketSchema),
        meta: t.Object(
          {
            total: t.Number(),
            page: t.Number(),
            pageSize: t.Number(),
            totalPages: t.Number(),
          },
          {
            description: "Pagination metadata",
          }
        ),
      },
      {
        description: "Response schema for getting tickets of an event",
      }
    ),
    detail: {
      summary: "Get all tickets for a specific event",
      operationId: "getEventTickets",
    },
  }
);
