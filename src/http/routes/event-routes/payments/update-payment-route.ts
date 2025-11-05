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
    description: "Schema for updating a payment",
  }
);

// Schema para os parâmetros que incluem eventId e id
const paymentParamsSchema = t.Object(
  {
    eventId: t.String({ format: "uuid" }),
    id: t.String({ format: "uuid" }),
  },
  {
    description: "Schema for payment parameters including eventId and id",
  }
);

export const updatePaymentRoute = new Elysia().macro(authMacro).put(
  "/:id",
  async ({ params, body, set }) => {
    try {
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

      // Verifica se o pagamento pertence ao evento correto antes de atualizar
      const existingPayment = await prisma.payment.findUnique({
        where: {
          id: params.id,
        },
        include: {
          member: true,
        },
      });

      if (
        !existingPayment ||
        existingPayment.member.eventId !== params.eventId
      ) {
        set.status = 404;
        return { error: "Payment not found in this event" };
      }

      await prisma.payment.update({
        where: { id: params.id },
        data: body,
      });
      set.status = 201;
    } catch {
      set.status = 404;
      return { error: "Payment not found in this event" };
    }
  },
  {
    auth: true,
    params: paymentParamsSchema,
    body: t.Partial(paymentBodySchema),
    response: {
      201: t.Void({
        description: "Payment updated successfully",
      }),
      404: t.Object(
        {
          error: t.String({
            description: "Error message",
          }),
        },
        {
          description: "Payment or Event not found",
        }
      ),
    },
    detail: {
      summary: "Update a payment by ID for a specific event",
      operationId: "updateEventPaymentById",
    },
  }
);
