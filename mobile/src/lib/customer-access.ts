import type { CustomerProfileRow, CustomerVehicleRow } from '@/lib/database.types';

export function customerProfileComplete(profile: CustomerProfileRow | null | undefined) {
  return Boolean(profile?.account_state === 'active' && profile.first_name?.trim()
    && profile.last_name?.trim() && profile.mobile?.trim());
}

export function selectAccountBookingVehicle(vehicles: readonly CustomerVehicleRow[], pending: { id: string; registration: string } | null) {
  const registration = (value: string) => value.trim().toUpperCase().replace(/\s/gu, '');
  return (pending ? vehicles.find((vehicle) => vehicle.id === pending.id)
    ?? vehicles.find((vehicle) => registration(vehicle.registration) === registration(pending.registration)) : undefined)
    ?? vehicles.find((vehicle) => vehicle.is_primary) ?? vehicles[0];
}

const CUSTOMER_RETURN_ROUTES = new Set([
  '/', '/garage', '/bookings', '/booking', '/account/sign-up', '/account/sign-up?mode=add', '/parts', '/history-import',
  '/vehicle-reports', '/vehicle-vault', '/performance-plus', '/alerts', '/messages',
  '/customer-cars-for-sale', '/events',
]);

// Only local customer routes and the two known booking types can survive sign in.
export function customerReturnPath(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return null;
  if (candidate === '/booking?type=service' || candidate === '/booking?type=dyno') return candidate;
  return CUSTOMER_RETURN_ROUTES.has(candidate) ? candidate : null;
}

export type CustomerAccessState = 'ready' | 'loading' | 'sign_in' | 'unavailable' | 'error' | 'profile' | 'vehicle' | 'restricted';

export function customerAccessState(input: {
  authEnabled: boolean;
  authStatus: string;
  accountStatus: string;
  profile: CustomerProfileRow | null | undefined;
  hasAccount: boolean;
  vehicleCount: number;
  profileRequired?: boolean;
  requireVehicle?: boolean;
}): CustomerAccessState {
  if (!input.authEnabled) return 'unavailable';
  if (input.authStatus === 'loading') return 'loading';
  if (input.authStatus !== 'signed_in') return 'sign_in';
  if (input.accountStatus === 'loading') return 'loading';
  if (input.accountStatus !== 'ready' || !input.hasAccount) return 'error';
  if (input.profile && input.profile.account_state !== 'active') return 'restricted';
  if (input.profileRequired !== false && !customerProfileComplete(input.profile)) return 'profile';
  if (input.requireVehicle && input.vehicleCount === 0) return 'vehicle';
  return 'ready';
}
