import * as Linking from 'expo-linking';

import type { HistoricalImportRequestRow } from '@/lib/database.types';
import { getSupabaseClient } from '@/lib/supabase';

export const HISTORY_IMPORT_PRICE_CENTS = 19_900;

export type HistoryImportCheckout = {
  checkoutUrl?: string;
  request: HistoricalImportRequestRow;
  state: HistoricalImportRequestRow['status'] | 'awaiting_payment';
};

export async function beginHistoryImportPayment(vehicleId: string, previousDetails: string) {
  const { data, error } = await getSupabaseClient().functions.invoke<HistoryImportCheckout>('create-history-import-payment', {
    body: { previousDetails: previousDetails.trim(), vehicleId },
  });
  if (error) throw error;
  if (!data?.request) throw new Error('HISTORY_IMPORT_RESPONSE_INVALID');
  if (data.checkoutUrl && !data.checkoutUrl.startsWith('https://checkout.stripe.com/')) throw new Error('HISTORY_IMPORT_CHECKOUT_INVALID');
  return data;
}

export async function openHistoryImportCheckout(checkoutUrl: string) {
  if (!checkoutUrl.startsWith('https://checkout.stripe.com/')) throw new Error('HISTORY_IMPORT_CHECKOUT_INVALID');
  const supported = await Linking.canOpenURL(checkoutUrl);
  if (!supported) throw new Error('HISTORY_IMPORT_CHECKOUT_UNAVAILABLE');
  await Linking.openURL(checkoutUrl);
}

export async function reviewHistoryImportRequest(input: {
  importedItemCount: number;
  requestId: string;
  staffNote: string;
  status: 'completed' | 'in_progress' | 'needs_information';
}) {
  const { data, error } = await getSupabaseClient().rpc('review_historical_import_request', {
    p_imported_item_count: input.importedItemCount,
    p_request_id: input.requestId,
    p_staff_note: input.staffNote.trim() || null,
    p_status: input.status,
  });
  if (error) throw error;
  return data;
}
