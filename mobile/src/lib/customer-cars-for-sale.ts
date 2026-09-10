export type CustomerCarListing = {
  id: string;
  title: string;
  registration: string;
  askingPriceCents: number;
  kilometres: number;
  transmission: string;
  summary: string;
  highlights: readonly string[];
  status: 'available' | 'under-offer';
};

/**
 * Live listings stay empty until PSI has the owner's clear permission to
 * publish the vehicle, price and identifying details. This prevents existing
 * private Garage records from becoming sale advertisements automatically.
 */
export const CUSTOMER_CARS_FOR_SALE: readonly CustomerCarListing[] = [];

export const PREVIEW_CUSTOMER_CARS_FOR_SALE: readonly CustomerCarListing[] = [
  {
    id: 'preview-vehicle-for-sale',
    title: '2016 Performance Sedan',
    registration: 'DEMO-01',
    askingPriceCents: 58_900_00,
    kilometres: 72_400,
    transmission: 'Automatic',
    summary: 'A fictional preview showing how an owner-approved PSI customer listing will appear.',
    highlights: ['PSI workshop history available', 'Owner-listed vehicle', 'Independent inspection welcomed'],
    status: 'available',
  },
];

export function formatAud(cents: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatKilometres(value: number) {
  return `${new Intl.NumberFormat('en-AU').format(value)} km`;
}

