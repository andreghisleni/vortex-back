import Elysia, { t } from "elysia";
import { authMacro } from "~/auth";
import { prisma } from "~/db/client";

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

export const deletePaymentRoute = new Elysia().macro(authMacro).delete(
  "/:id",
  async ({ params, user, set }) => {
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

      // Verifica se o pagamento pertence ao evento correto antes de deletar
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
        data: {
          deletedAt: new Date(),
          deletedBy: user.id,
        },
      });

      set.status = 204;
    } catch {
      set.status = 404;
      return { error: "Payment not found in this event" };
    }
  },
  {
    auth: true,
    params: paymentParamsSchema,
    response: {
      204: t.Void({
        description: "Payment deleted successfully",
      }),
      404: t.Object({
        error: t.String({
          description: "Error message",
        }),
      }),
    },
    detail: {
      summary: "Soft delete a payment by ID for a specific event",
      operationId: "deleteEventPaymentById",
    },
  }
);
