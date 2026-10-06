import { PaymentAttempt } from './payment-attempt.model.js';
import { PaymentEvent } from './payment-event.model.js';
import { Refund } from './refund.model.js';

export async function ensurePaymentIndexes() {
  await Promise.all([PaymentAttempt.createIndexes(), PaymentEvent.createIndexes(), Refund.createIndexes()]);
}

export const paymentModels = Object.freeze([PaymentAttempt, PaymentEvent, Refund]);
