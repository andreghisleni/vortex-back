import type { Prisma } from "@prisma/client";
import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

export const orderTypeSchema = t.Union([t.Literal("asc"), t.Literal("desc")], {
  description: "Type of the order",
});

// Schema para o enum PaymentType
const paymentTypeSchema = t.Union([t.Literal("CASH"), t.Literal("PIX")]);

// Schema para o modelo Payment
const paymentSchema = t.Object(
  {
    id: t.String({ format: "uuid" }),
    visionId: t.Nullable(t.String()),
    amount: t.Number(),
    type: paymentTypeSchema,
    payedAt: t.Date(),
    memberId: t.String({ format: "uuid" }),
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
          description: "Member associated with the payment",
        }
      )
    ),
    createdAt: t.Date(),
    updatedAt: t.Date(),
    deletedAt: t.Nullable(t.Date()),
    deletedBy: t.Nullable(t.String()),
  },
  {
    description: "Schema for a payment",
  }
);

// Schema para os parâmetros que incluem eventId
const eventParamsSchema = t.Object({
  eventId: t.String({ format: "uuid" }),
});

export const getPaymentsRoute = new Elysia().macro(authMacro).get(
  "/",
  async ({ params, query }) => {
    const orderBy = [
      query?.["ob.visionId"] && { visionId: query?.["ob.visionId"] },
      query?.["ob.amount"] && { amount: query?.["ob.amount"] },
      query?.["ob.type"] && { type: query?.["ob.type"] },
      query?.["ob.payedAt"] && { payedAt: query?.["ob.payedAt"] },
      query?.["ob.createdAt"]
        ? { createdAt: query?.["ob.createdAt"] }
        : { createdAt: "desc" },
    ];

    const orFilters: Prisma.PaymentWhereInput[] = [
      {
        visionId: {
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

    if (!Number.isNaN(Number.parseFloat(query?.["f.filter"] || ""))) {
      orFilters.push({
        amount: {
          equals: Number.parseFloat(query?.["f.filter"] || ""),
        },
      });
    }

    const [payments, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where: {
          deletedAt: null,
          member: {
            eventId: params.eventId,
          },
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
      prisma.payment.count({
        where: {
          deletedAt: null,
          member: {
            eventId: params.eventId,
          },
          OR: query?.["f.filter"] ? orFilters : undefined,
        },
      }),
    ]);

    return {
      data: payments,
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
          description: "Filter by payment visionId, member name, or amount",
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
      "ob.visionId": t.Optional(orderTypeSchema),
      "ob.amount": t.Optional(orderTypeSchema),
      "ob.type": t.Optional(orderTypeSchema),
      "ob.payedAt": t.Optional(orderTypeSchema),
      "ob.createdAt": t.Optional(orderTypeSchema),
    }),
    response: t.Object({
      data: t.Array(paymentSchema),
      meta: t.Object({
        total: t.Number(),
        page: t.Number(),
        pageSize: t.Number(),
        totalPages: t.Number(),
      }),
    }),
    detail: {
      summary: "Get all active payments for a specific event",
      operationId: "getAllEventPayments",
    },
  }
);
