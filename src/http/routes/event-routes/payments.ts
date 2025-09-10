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

// Schema para o corpo da requisição
const paymentBodySchema = t.Object({
  amount: t.Number(),
  type: paymentTypeSchema,
  memberId: t.String({ format: 'uuid' }),
  visionId: t.Optional(t.String()),
  payedAt: t.Optional(t.Date()),
});

export const payments = new Elysia({
  prefix: '/payments',
  name: 'Payments',
  tags: ['Payments'],
})
  .macro(authMacro)
  .get(
    '/',
    async () => {
      return await prisma.payment.findMany({ where: { deletedAt: null } });
    },
    {
      auth: true,
      detail: { summary: 'Get all active payments' },
      response: t.Array(paymentSchema),
    }
  )
  .post(
    '/',
    async ({ body }) => {
      return await prisma.payment.create({ data: body });
    },
    {
      auth: true,
      body: paymentBodySchema,
      response: paymentSchema,
      detail: { summary: 'Create a new payment' },
    }
  )
  .get(
    '/:id',
    async ({ params, set }) => {
      const payment = await prisma.payment.findUnique({
        where: { id: params.id },
      });
      if (!payment || payment.deletedAt) {
        set.status = 404;
        return { error: 'Payment not found' };
      }
      return payment;
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: { 200: paymentSchema, 404: t.Object({ error: t.String() }) },
      detail: { summary: 'Get a payment by ID' },
    }
  )
  .put(
    '/:id',
    async ({ params, body, set }) => {
      try {
        return await prisma.payment.update({
          where: { id: params.id },
          data: body,
        });
      } catch (e) {
        set.status = 404;
        return { error: 'Payment not found' };
      }
    },
    {
      auth: true,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      body: t.Partial(paymentBodySchema),
      response: { 200: paymentSchema, 404: t.Object({ error: t.String() }) },
      detail: { summary: 'Update a payment by ID' },
    }
  )
  .delete(
    '/:id',
    async ({ params, user, set }) => {
      try {
        await prisma.payment.update({
          where: { id: params.id },
          data: {
            deletedAt: new Date(),
            deletedBy: user.id,
          },
        });
        set.status = 204;
      } catch (e) {
        set.status = 404;
        return { error: 'Payment not found' };
      }
    },
    {
      auth: true,
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      response: { 204: t.Void(), 404: t.Object({ error: t.String() }) },
      detail: { summary: 'Soft delete a payment by ID' },
    }
  );
