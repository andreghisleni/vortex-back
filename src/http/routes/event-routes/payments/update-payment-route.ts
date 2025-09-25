import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

// Schema para o enum PaymentType
const paymentTypeSchema = t.Union([t.Literal('CASH'), t.Literal('PIX')]);

// Schema para o corpo da requisição
const paymentBodySchema = t.Object({
  amount: t.Number(),
  type: paymentTypeSchema,
  memberId: t.String({ format: 'uuid' }),
  visionId: t.Optional(t.String()),
  payedAt: t.Optional(t.Date()),
});

// Schema para os parâmetros que incluem eventId e id
const paymentParamsSchema = t.Object({
  eventId: t.String({ format: 'uuid' }),
  id: t.String({ format: 'uuid' }),
});

export const updatePaymentRoute = new Elysia()
  .macro(authMacro)
  .put(
    '/:id',
    async ({ params, body, set }) => {
      try {
        // Verifica se o pagamento pertence ao evento correto antes de atualizar
        const existingPayment = await prisma.payment.findUnique({
          where: {
            id: params.id,
          },
          include: {
            member: true,
          },
        });

        if (!existingPayment || existingPayment.member.eventId !== params.eventId) {
          set.status = 404;
          return { error: 'Payment not found in this event' };
        }

        await prisma.payment.update({
          where: { id: params.id },
          data: body,
        });
        set.status = 201;
      } catch {
        set.status = 404;
        return { error: 'Payment not found in this event' };
      }
    },
    {
      auth: true,
      params: paymentParamsSchema,
      body: t.Partial(paymentBodySchema),
      response: {
        201: t.Void({
          description: 'Payment updated successfully',
        }),
        404: t.Object({
          error: t.String({
            description: 'Error message',
          }),
        }),
      },
      detail: {
        summary: 'Update a payment by ID for a specific event',
        operationId: 'updateEventPaymentById',
      },
    }
  );