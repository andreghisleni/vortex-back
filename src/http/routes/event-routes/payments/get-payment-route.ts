import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

// Schema para o enum PaymentType
export const paymentTypeSchema = t.Union([t.Literal("CASH"), t.Literal("PIX")]);

// Schema para o modelo Payment
const paymentSchema = t.Object(
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
    description: "Schema for a payment",
  }
);

// Schema para os parâmetros que incluem eventId e id
const paymentParamsSchema = t.Object({
  eventId: t.String({ format: "uuid" }),
  id: t.String({ format: "uuid" }),
});

export const getPaymentRoute = new Elysia().macro(authMacro).get(
  "/:id",
  async ({ params, set }) => {
    const payment = await prisma.payment.findUnique({
      where: {
        id: params.id,
        member: { eventId: params.eventId },
      },
    });

    if (!payment || payment.deletedAt) {
      set.status = 404;
      return { error: "Payment not found in this event or was deleted" };
    }

    return payment;
  },
  {
    params: paymentParamsSchema,
    response: {
      200: paymentSchema,
      404: t.Object({
        error: t.String({
          description: "Error message",
        }),
      }),
    },
    detail: {
      summary: "Get a payment by ID for a specific event",
      operationId: "getEventPaymentById",
    },
  }
);
