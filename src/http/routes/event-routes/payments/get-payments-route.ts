import Elysia, { t } from 'elysia';
import { authMacro } from '~/auth';
import { prisma } from '~/db/client';

// Schema para o enum PaymentType
const paymentTypeSchema = t.Union([t.Literal('CASH'), t.Literal('PIX')]);

// Schema para o modelo Payment
const paymentSchema = t.Object({
  id: t.String({ format: 'uuid' }),
  visionId: t.Nullable(t.String()),
  amount: t.Number(),
  type: paymentTypeSchema,
  payedAt: t.Date(),
  memberId: t.String({ format: 'uuid' }),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  deletedAt: t.Nullable(t.Date()),
  deletedBy: t.Nullable(t.String()),
});

// Schema para os parâmetros que incluem eventId
const eventParamsSchema = t.Object({
  eventId: t.String({ format: 'uuid' }),
});

export const getPaymentsRoute = new Elysia()
  .macro(authMacro)
  .get(
    '/',
    async ({ params }) => {
      return await prisma.payment.findMany({
        where: {
          deletedAt: null,
          member: {
            eventId: params.eventId,
          },
        },
      });
    },
    {
      auth: true,
      params: eventParamsSchema,
      response: t.Array(paymentSchema),
      detail: {
        summary: 'Get all active payments for a specific event',
        operationId: 'getAllEventPayments',
      },
    }
  );