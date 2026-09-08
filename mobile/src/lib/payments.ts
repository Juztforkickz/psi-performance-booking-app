import { Linking } from 'react-native';

import { getSupabaseClient } from '@/lib/supabase';

export type BankTransferInstructions = {
  amountCents: number;
  bank: { accountName: string; accountNumber: string; bsb: string };
  currency: 'AUD';
  paymentMethod: 'bank_transfer';
  reference: string;
  state: 'bank_transfer_pending';
};

export type StripeCheckout = {
  amountCents: number;
  checkoutUrl: string;
  currency: 'AUD';
  expiresAt: string;
  paymentMethod: 'stripe';
  state: 'awaiting_payment';
};

export async function beginBookingPayment(bookingId: string, paymentMethod: 'bank_transfer' | 'stripe') {
  const { data, error } = await getSupabaseClient().functions.invoke<BankTransferInstructions | StripeCheckout>('create-booking-payment', {
    body: { bookingId, paymentMethod },
  });
  if (error) throw error;
  if (!data || data.paymentMethod !== paymentMethod) throw new Error('PAYMENT_RESPONSE_INVALID');
  return data;
}

export async function openStripeCheckout(checkout: StripeCheckout) {
  if (!checkout.checkoutUrl.startsWith('https://checkout.stripe.com/')) throw new Error('CHECKOUT_URL_INVALID');
  const supported = await Linking.canOpenURL(checkout.checkoutUrl);
  if (!supported) throw new Error('CHECKOUT_UNAVAILABLE');
  await Linking.openURL(checkout.checkoutUrl);
}
