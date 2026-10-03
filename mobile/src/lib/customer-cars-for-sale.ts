import type { CustomerCarListingRow } from '@/lib/database.types';
import { dispatchCustomerCarSalePushNotifications } from '@/lib/notifications';
import { REVIEW_ENVIRONMENT } from '@/lib/review-environment';
import { loadStaffMfaSecurityAccess } from '@/lib/staff-portal';
import { getSupabaseClient, SUPABASE_CONNECTION } from '@/lib/supabase';

export type CustomerCarListing = {
  askingPriceCents: number;
  highlights: readonly string[];
  id: string;
  kilometres: number;
  registration: string;
  status: 'available' | 'under-offer';
  summary: string;
  title: string;
  transmission: string;
};

export type CustomerCarListingDraft = {
  askingPriceCents: number;
  highlights: string[];
  kilometres: number;
  registration: string;
  summary: string;
  title: string;
  transmission: string;
};

export const PREVIEW_CUSTOMER_CARS_FOR_SALE: readonly CustomerCarListing[] = [
  {
    id: 'preview-vehicle-for-sale',
    title: '2016 Performance Sedan',
    registration: 'DEMO01',
    askingPriceCents: 58_900_00,
    kilometres: 72_400,
    transmission: 'Automatic',
    summary: 'A fictional preview showing how an owner approved PSI customer listing will appear.',
    highlights: ['PSI workshop history available', 'Owner listed vehicle', 'Independent inspection welcomed'],
    status: 'available',
  },
];

export const CUSTOMER_CARS_FOR_SALE: readonly CustomerCarListing[] = [];

export async function loadCustomerCarsForSale(): Promise<CustomerCarListing[]> {
  if (!SUPABASE_CONNECTION.authEnabled) return [];
  const { data, error } = await getSupabaseClient()
    .from('customer_car_listings')
    .select('*')
    .in('status', ['published', 'under_offer'])
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toCustomerListing);
}

export async function loadStaffCustomerCarListings(): Promise<CustomerCarListingRow[]> {
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready') throw new Error('STAFF_AAL2_REQUIRED');
  const { data, error } = await getSupabaseClient()
    .from('customer_car_listings')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createCustomerCarListing(input: CustomerCarListingDraft, publish: boolean) {
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready' || !access.staff.user_id) throw new Error('STAFF_AAL2_REQUIRED');
  const listing = validateDraft(input);
  const { data, error } = await getSupabaseClient()
    .from('customer_car_listings')
    .insert({
      ...listing,
      created_by: access.staff.user_id,
      published_at: publish ? new Date().toISOString() : null,
      status: publish ? 'published' : 'draft',
    })
    .select('*')
    .single();
  if (error) throw error;
  if (publish) await retryCustomerCarSaleNotifications(data.id).catch(() => undefined);
  return data;
}

export async function updateCustomerCarListing(listingId: string, input: CustomerCarListingDraft) {
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready') throw new Error('STAFF_AAL2_REQUIRED');
  const { data, error } = await getSupabaseClient()
    .from('customer_car_listings')
    .update(validateDraft(input))
    .eq('id', listingId)
    .neq('status', 'sold')
    .neq('status', 'withdrawn')
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function setCustomerCarListingStatus(listingId: string, status: 'published' | 'sold' | 'under_offer' | 'withdrawn') {
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready') throw new Error('STAFF_AAL2_REQUIRED');
  const update = status === 'published'
    ? { published_at: new Date().toISOString(), status }
    : { status };
  const { data, error } = await getSupabaseClient()
    .from('customer_car_listings')
    .update(update)
    .eq('id', listingId)
    .select('*')
    .single();
  if (error) throw error;
  if (status === 'published') await retryCustomerCarSaleNotifications(data.id).catch(() => undefined);
  return data;
}

export async function retryCustomerCarSaleNotifications(listingId: string) {
  if (REVIEW_ENVIRONMENT.enabled || !SUPABASE_CONNECTION.authEnabled) return;
  const results = await Promise.allSettled([
    dispatchCustomerCarSalePushNotifications(listingId),
    dispatchCustomerCarSaleEmails(listingId),
  ]);
  if (results.every((result) => result.status === 'rejected')) throw new Error('CAR_SALE_DELIVERY_UNAVAILABLE');
}

async function dispatchCustomerCarSaleEmails(listingId: string) {
  for (let batch = 0; batch < 10; batch += 1) {
    const { data, error } = await getSupabaseClient().functions.invoke<{ processed: number }>('process-car-sale-notifications', { body: { listingId } });
    if (error) throw error;
    if (!data || data.processed < 100) break;
  }
}

function toCustomerListing(row: CustomerCarListingRow): CustomerCarListing {
  return {
    askingPriceCents: row.asking_price_cents,
    highlights: row.highlights,
    id: row.id,
    kilometres: row.kilometres,
    registration: row.registration,
    status: row.status === 'under_offer' ? 'under-offer' : 'available',
    summary: row.summary,
    title: row.title,
    transmission: row.transmission,
  };
}

function validateDraft(input: CustomerCarListingDraft) {
  const title = input.title.trim();
  const registration = input.registration.trim().toUpperCase();
  const transmission = input.transmission.trim();
  const summary = input.summary.trim();
  const highlights = input.highlights.map((value) => value.trim()).filter(Boolean);
  if (!title || title.length > 100) throw new Error('CAR_LISTING_TITLE_INVALID');
  if (!registration || registration.length > 16) throw new Error('CAR_LISTING_REGISTRATION_INVALID');
  if (!Number.isInteger(input.askingPriceCents) || input.askingPriceCents < 1 || input.askingPriceCents > 2_000_000_000) throw new Error('CAR_LISTING_PRICE_INVALID');
  if (!Number.isInteger(input.kilometres) || input.kilometres < 0 || input.kilometres > 3_000_000) throw new Error('CAR_LISTING_KILOMETRES_INVALID');
  if (!transmission || transmission.length > 40) throw new Error('CAR_LISTING_TRANSMISSION_INVALID');
  if (!summary || summary.length > 1000) throw new Error('CAR_LISTING_SUMMARY_INVALID');
  if (!highlights.length || highlights.length > 6 || highlights.some((value) => value.length > 120)) throw new Error('CAR_LISTING_HIGHLIGHTS_INVALID');
  return {
    asking_price_cents: input.askingPriceCents,
    highlights,
    kilometres: input.kilometres,
    registration,
    summary,
    title,
    transmission,
  };
}

export function formatAud(cents: number) {
  return `${new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100)} AUD`;
}

export function formatKilometres(value: number) {
  return `${new Intl.NumberFormat('en-AU').format(value)} km`;
}
