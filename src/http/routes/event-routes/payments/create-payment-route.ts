import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

// Schema para o enum PaymentType
const paymentTypeSchema = t.Union([t.Literal("CASH"), t.Literal("PIX")]);

// Schema para o corpo da requisição
const paymentBodySchema = t.Object(
  {
    amount: t.Number(),
    type: paymentTypeSchema,
    memberId: t.String({ format: "uuid" }),
    visionId: t.Optional(t.String()),
    payedAt: t.Optional(t.Date()),
  },
  {
    description: "Schema for creating a new payment",
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

export const createPaymentRoute = new Elysia().macro(authMacro).post(
  "/",
  async ({ body, params, set }) => {
    // Verifica se o evento existe e se não está em modo somente leitura
    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
    });
    if (!event) {
      set.status = 404;
      return { error: "Event not found" };
    }

    if (event.readOnly) {
      set.status = 403;
      return { error: "Event is read-only" };
    }

    const member = await prisma.member.findUnique({
      where: { id: body.memberId },
    });

    if (!member || member.eventId !== params.eventId) {
      set.status = 400;
      return { error: "Member does not belong to the specified event" };
    }

    await prisma.payment.create({
      data: body,
    });

    set.status = 201;
  },
  {
    auth: true,
    params: eventParamsSchema,
    body: paymentBodySchema,
    response: {
      201: t.Void({
        description: "Payment created successfully",
      }),
    },
    detail: {
      summary: "Create a new payment for a specific event",
      operationId: "createEventPayment",
    },
  }
);
