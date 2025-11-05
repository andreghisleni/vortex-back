import type { Prisma } from "@prisma/client";
import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

export const orderTypeSchema = t.Union([t.Literal("asc"), t.Literal("desc")], {
  description: "Type of the order",
});

// Schema para o modelo TicketRange
const ticketRangeSchema = t.Object(
  {
    id: t.String({ format: "uuid" }),
    start: t.Number(),
    end: t.Number(),
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
          createdAt: t.Date(),
        },
        {
          description: "Member associated with the ticket range",
        }
      )
    ),
    generatedAt: t.Nullable(t.Date()),
    eventId: t.String({ format: "uuid" }),
    createdAt: t.Date(),
    deletedAt: t.Nullable(t.Date()),
  },
  {
    description: "Schema for a ticket range",
  }
);

// Schema para os parâmetros que incluem eventId
const eventParamsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
  },
  {
    description: "Schema for event parameters including eventId",
  }
);

export const getTicketRangesRoute = new Elysia().macro(authMacro).get(
  "/",
  async ({ params, query }) => {
    const orderBy = [
      query?.["ob.start"] && { start: query?.["ob.start"] },
      query?.["ob.end"] && { end: query?.["ob.end"] },
      query?.["ob.generatedAt"] && { generatedAt: query?.["ob.generatedAt"] },
      query?.["ob.createdAt"]
        ? { createdAt: query?.["ob.createdAt"] }
        : { createdAt: "desc" },
    ];

    const orFilters: Prisma.TicketRangeWhereInput[] = [
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
      const filterNumber = Number.parseInt(query?.["f.filter"] || "", 10);
      orFilters.push(
        {
          start: {
            gte: filterNumber,
          },
        },
        {
          end: {
            lte: filterNumber,
          },
        }
      );
    }

    const [ticketRanges, total] = await prisma.$transaction([
      prisma.ticketRange.findMany({
        where: {
          deletedAt: null,
          eventId: params.eventId,
          memberId: query?.["f.memberId"],
          OR: query?.["f.filter"] ? orFilters : undefined,
        },
        include: {
          member: true,
        },
        take: query?.["p.pageSize"] ?? 20,
        skip:
          ((query?.["p.page"] ?? 1) - 1) * (query?.["p.pageSize"] ?? 20) ||
          undefined,
        orderBy: [...orderBy.filter((o) => o !== undefined)],
      }),
      prisma.ticketRange.count({
        where: {
          deletedAt: null,
          eventId: params.eventId,
          memberId: query?.["f.memberId"],
          OR: query?.["f.filter"] ? orFilters : undefined,
        },
      }),
    ]);

    return {
      data: ticketRanges,
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
          description: "Filter by start/end range or member name",
        })
      ),
      "f.memberId": t.Optional(
        t.String({
          description: "Filter by member ID",
          format: "uuid",
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
      "ob.start": t.Optional(orderTypeSchema),
      "ob.end": t.Optional(orderTypeSchema),
      "ob.generatedAt": t.Optional(orderTypeSchema),
      "ob.createdAt": t.Optional(orderTypeSchema),
    }),
    response: t.Object(
      {
        data: t.Array(ticketRangeSchema),
        meta: t.Object({
          total: t.Number(),
          page: t.Number(),
          pageSize: t.Number(),
          totalPages: t.Number(),
        }),
      },
      {
        description: "Response schema for getting ticket ranges",
      }
    ),
    detail: {
      summary: "Get all active ticket ranges for a specific event",
      operationId: "getAllEventTicketRanges",
    },
  }
);
