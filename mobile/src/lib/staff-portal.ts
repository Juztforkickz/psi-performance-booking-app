import { australianDateToIso } from '@/lib/australian-date';
import type {
  AccountDeletionRequestRow,
  AuditEventRow,
  BookingIntegrationJobRow,
  BookingRequestRow,
  CustomerInvitationRow,
  CustomerProfileRow,
  CustomerVehicleRow,
  StaffMemberRow,
  VehicleFileRow,
} from '@/lib/database.types';
import { dispatchBookingIntegrationNotifications } from '@/lib/booking-integrations';
import { getSupabaseClient } from '@/lib/supabase';
import { dispatchBookingPushNotifications } from '@/lib/notifications';

export type StaffPortalAccess =
  | { kind: 'access_denied' }
  | { kind: 'mfa_required'; staff: StaffMemberRow; verifiedTotpFactors: StaffMfaFactor[] }
  | { kind: 'ready'; snapshot: StaffPortalSnapshot; staff: StaffMemberRow; verifiedTotpFactors: StaffMfaFactor[] };

export type StaffMfaSecurityAccess =
  | { kind: 'access_denied' }
  | { kind: 'mfa_required' }
  | { kind: 'ready'; staff: StaffMemberRow; verifiedTotpFactors: StaffMfaFactor[] };

export type StaffMfaFactor = {
  createdAt: string;
  friendlyName: string;
  id: string;
};

export type StaffTotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};

export type StaffBookingReviewInput = {
  action: 'approve_date' | 'cancel' | 'propose_date';
  approvedDate: string;
  bookingId: string;
  staffNote: string;
};

export type StaffPortalSnapshot = {
  accountDeletionRequests: AccountDeletionRequestRow[];
  auditEvents: AuditEventRow[];
  bookings: BookingRequestRow[];
  customers: CustomerProfileRow[];
  deletionCustomers: CustomerProfileRow[];
  invitations: CustomerInvitationRow[];
  integrationJobs: BookingIntegrationJobRow[];
  vehicleFiles: VehicleFileRow[];
  vehicles: CustomerVehicleRow[];
};

export type CustomerInvitationResult = {
  created: boolean;
  invitation: Pick<CustomerInvitationRow, 'accepted_at' | 'email' | 'id' | 'invited_at' | 'status'>;
  nextStep: 'send_testflight_invitation';
};

export type AccountDeletionCompletionResult = {
  auditWarning: boolean;
  completed: true;
  completion: {
    completed: true;
    completedAt: string;
    completionReference: string;
  } | null;
  databaseSummary: {
    bookingsRemoved: number;
    databaseFilesRemoved: number;
    vehiclesRemoved: number;
  };
  storageObjectsRemoved: number;
};

export type BookingIntegrationRunResult = {
  processed: number;
  readiness: {
    calendarConfigured: boolean;
    emailConfigured: boolean;
    paymentsConfigured: false;
  };
  results: {
    errorCode?: string;
    jobId: string;
    kind: BookingIntegrationJobRow['job_kind'];
    status: 'blocked_configuration' | 'failed' | 'skipped' | 'succeeded';
  }[];
};

export async function loadStaffPortalAccess(): Promise<StaffPortalAccess> {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('STAFF_SESSION_REQUIRED');

  const { data: staff, error: staffError } = await supabase
    .from('staff_members')
    .select('*')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (staffError) throw staffError;
  if (!staff || staff.status !== 'active') return { kind: 'access_denied' };

  const [assuranceResult, factorsResult] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (assuranceResult.error) throw assuranceResult.error;
  if (factorsResult.error) throw factorsResult.error;
  const verifiedTotpFactors = mapVerifiedTotpFactors(factorsResult.data.totp);
  if (assuranceResult.data.currentLevel !== 'aal2') {
    return {
      kind: 'mfa_required',
      staff,
      verifiedTotpFactors,
    };
  }

  const [customersResult, deletionCustomersResult, vehiclesResult, bookingsResult, integrationJobsResult, auditEventsResult, vehicleFilesResult, accountDeletionRequestsResult, invitationsResult] = await Promise.all([
    supabase.from('customer_profiles').select('*').eq('account_state', 'active').order('last_name').order('first_name'),
    supabase.from('customer_profiles').select('*').order('last_name').order('first_name'),
    supabase.from('customer_vehicles').select('*').is('archived_at', null).order('updated_at', { ascending: false }),
    supabase.from('booking_requests').select('*').is('archived_at', null).order('created_at', { ascending: false }).limit(50),
    supabase.from('booking_integration_jobs').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('audit_events').select('*').order('occurred_at', { ascending: false }).limit(50),
    supabase.from('vehicle_files').select('*').eq('file_kind', 'vehicle_photo').is('archived_at', null).order('created_at', { ascending: false }).limit(100),
    supabase.from('account_deletion_requests').select('*').order('requested_at', { ascending: true }),
    supabase.from('customer_invitations').select('*').order('invited_at', { ascending: false }).limit(100),
  ]);
  const firstError = customersResult.error
    ?? deletionCustomersResult.error
    ?? vehiclesResult.error
    ?? bookingsResult.error
    ?? integrationJobsResult.error
    ?? auditEventsResult.error
    ?? vehicleFilesResult.error
    ?? accountDeletionRequestsResult.error
    ?? invitationsResult.error;
  if (firstError) throw firstError;

  return {
    kind: 'ready',
    staff,
    verifiedTotpFactors,
    snapshot: {
      accountDeletionRequests: accountDeletionRequestsResult.data ?? [],
      auditEvents: auditEventsResult.data ?? [],
      bookings: bookingsResult.data ?? [],
      customers: customersResult.data ?? [],
      deletionCustomers: deletionCustomersResult.data ?? [],
      integrationJobs: integrationJobsResult.data ?? [],
      invitations: invitationsResult.data ?? [],
      vehicleFiles: vehicleFilesResult.data ?? [],
      vehicles: vehiclesResult.data ?? [],
    },
  };
}

export async function completeCustomerAccountDeletion(input: {
  confirmationEmail: string;
  retentionReviewConfirmed: boolean;
  staffNote: string;
  userId: string;
}): Promise<AccountDeletionCompletionResult> {
  const confirmationEmail = input.confirmationEmail.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(confirmationEmail) || confirmationEmail.length > 160) {
    throw new Error('CONFIRMATION_EMAIL_INVALID');
  }
  if (!input.retentionReviewConfirmed) throw new Error('RETENTION_REVIEW_REQUIRED');
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready' || access.staff.role !== 'owner') throw new Error('STAFF_OWNER_AAL2_REQUIRED');

  const { data, error } = await getSupabaseClient().functions.invoke<AccountDeletionCompletionResult>('complete-account-deletion', {
    body: {
      confirmationEmail,
      retentionReviewConfirmed: true,
      staffNote: input.staffNote.trim().slice(0, 500),
      userId: input.userId,
    },
  });
  if (error) throw error;
  if (!data?.completed) throw new Error('ACCOUNT_DELETION_RESPONSE_INVALID');
  return data;
}

export async function inviteCustomer(email: string): Promise<CustomerInvitationResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedEmail.length > 160) throw new Error('INVALID_CUSTOMER_EMAIL');
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready' || access.staff.role !== 'owner') throw new Error('STAFF_OWNER_AAL2_REQUIRED');

  const { data, error } = await getSupabaseClient().functions.invoke<CustomerInvitationResult>('invite-customer', {
    body: { email: normalizedEmail },
  });
  if (error) throw error;
  if (!data?.invitation || data.nextStep !== 'send_testflight_invitation') throw new Error('CUSTOMER_INVITATION_RESPONSE_INVALID');
  return data;
}

export async function loadStaffMfaSecurityAccess(): Promise<StaffMfaSecurityAccess> {
  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error('STAFF_SESSION_REQUIRED');

  const { data: staff, error: staffError } = await supabase
    .from('staff_members')
    .select('*')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (staffError) throw staffError;
  if (!staff || staff.status !== 'active') return { kind: 'access_denied' };

  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) throw assuranceError;
  if (assurance.currentLevel !== 'aal2') return { kind: 'mfa_required' };

  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) throw factorsError;
  return {
    kind: 'ready',
    staff,
    verifiedTotpFactors: mapVerifiedTotpFactors(factors.totp),
  };
}

export async function reviewBookingRequest(input: StaffBookingReviewInput) {
  const supabase = getSupabaseClient();
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready') throw new Error('STAFF_AAL2_REQUIRED');

  const approvedDate = input.action === 'cancel' ? null : requiredReviewDate(input.approvedDate);
  const staffNote = input.staffNote.trim();
  if (input.action === 'cancel' && !staffNote) throw new Error('CANCELLATION_NOTE_REQUIRED');
  const state = input.action === 'approve_date'
    ? 'date_approved' as const
    : input.action === 'propose_date'
      ? 'date_proposed' as const
      : 'cancelled' as const;
  const { data, error } = await supabase
    .from('booking_requests')
    .update({ approved_date: approvedDate, staff_note: staffNote || null, state })
    .eq('id', input.bookingId)
    .select('*')
    .single();
  if (error) throw error;
  await Promise.allSettled([
    dispatchBookingIntegrationNotifications(data.id),
    dispatchBookingPushNotifications(data.id),
  ]);
  return data;
}

export async function processBookingIntegrationJobs(limit = 10): Promise<BookingIntegrationRunResult> {
  const supabase = getSupabaseClient();
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready') throw new Error('STAFF_AAL2_REQUIRED');

  const { data, error } = await supabase.functions.invoke<BookingIntegrationRunResult>('process-booking-integrations', {
    body: { limit: Math.min(10, Math.max(1, Math.trunc(limit))) },
  });
  if (error) throw error;
  if (!data || typeof data.processed !== 'number' || !data.readiness) throw new Error('INTEGRATION_WORKER_RESPONSE_INVALID');
  return data;
}

export async function loadStaffVehiclePhotoUrls(files: readonly VehicleFileRow[]) {
  const supabase = getSupabaseClient();
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready') throw new Error('STAFF_AAL2_REQUIRED');

  const newestByVehicle = new Map<string, VehicleFileRow>();
  files.forEach((file) => {
    if (
      !newestByVehicle.has(file.vehicle_id)
      && file.bucket_id === 'vehicle-photos'
      && file.file_kind === 'vehicle_photo'
      && file.archived_at === null
      && file.object_path.startsWith(`${file.customer_id}/`)
    ) {
      newestByVehicle.set(file.vehicle_id, file);
    }
  });

  const signedEntries = await Promise.all([...newestByVehicle.entries()].map(async ([vehicleId, file]) => {
    const { data, error } = await supabase.storage.from('vehicle-photos').createSignedUrl(file.object_path, 10 * 60);
    if (error) return null;
    return [vehicleId, data.signedUrl] as const;
  }));
  return Object.fromEntries(signedEntries.filter((entry): entry is readonly [string, string] => entry !== null));
}

export async function beginStaffTotpEnrollment(friendlyName = 'PSI Performance staff'): Promise<StaffTotpEnrollment> {
  const supabase = getSupabaseClient();
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) throw factorsError;

  const staleTotpFactors = factors.all.filter((factor) => factor.factor_type === 'totp' && factor.status === 'unverified');
  for (const factor of staleTotpFactors) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) throw error;
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName,
    issuer: 'PSI Performance',
  });
  if (error) throw error;
  return {
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function verifyStaffTotp(factorId: string, code: string) {
  const normalizedCode = code.replace(/\s/gu, '');
  if (!/^\d{6}$/.test(normalizedCode)) throw new Error('INVALID_MFA_CODE');
  const { error } = await getSupabaseClient().auth.mfa.challengeAndVerify({
    code: normalizedCode,
    factorId,
  });
  if (error) throw error;
}

export async function cancelStaffTotpEnrollment(factorId: string) {
  const supabase = getSupabaseClient();
  const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
  if (factorsError) throw factorsError;
  const factor = factors.all.find((item) => item.id === factorId && item.factor_type === 'totp');
  if (!factor || factor.status !== 'unverified') return;
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

export async function removeStaffTotpFactor(factorId: string) {
  const supabase = getSupabaseClient();
  const access = await loadStaffMfaSecurityAccess();
  if (access.kind !== 'ready') throw new Error('STAFF_AAL2_REQUIRED');
  if (!access.verifiedTotpFactors.some((factor) => factor.id === factorId)) throw new Error('STAFF_MFA_FACTOR_NOT_FOUND');
  if (access.verifiedTotpFactors.length < 2) throw new Error('STAFF_LAST_MFA_FACTOR');

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    await supabase.auth.signOut({ scope: 'local' });
    return { requiresSignIn: true } as const;
  }
  return { requiresSignIn: false } as const;
}

function mapVerifiedTotpFactors(factors: { created_at: string; friendly_name?: string; id: string }[]) {
  return factors.map((factor) => ({
    createdAt: factor.created_at,
    friendlyName: factor.friendly_name ?? 'PSI staff authenticator',
    id: factor.id,
  }));
}

function requiredReviewDate(value: string) {
  const normalized = australianDateToIso(value);
  if (!normalized) throw new Error('BOOKING_REVIEW_DATE_INVALID');
  return normalized;
}
