import Elysia from 'elysia';
import { createPaymentRoute } from './create-payment-route';
import { deletePaymentRoute } from './delete-payment-route';
import { getPaymentRoute } from './get-payment-route';
import { getPaymentsRoute } from './get-payments-route';
import { updatePaymentRoute } from './update-payment-route';

export const payments = new Elysia({
  prefix: '/payments',
  tags: ['Event - Payments'],
})
  .use(createPaymentRoute)
  .use(getPaymentsRoute)
  .use(getPaymentRoute)
  .use(updatePaymentRoute)
  .use(deletePaymentRoute);