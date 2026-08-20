import { adminError, authorizeAdmin } from "../_auth";

function legacyAdminDisabled() {
  return adminError(
    410,
    "LEGACY_ADMIN_DISABLED",
    "The legacy booking-status API is disabled. Use the approval-first booking request API.",
    { Link: '</api/v1/admin/booking-requests>; rel="successor-version"' },
  );
}

export async function GET(request: Request) {
  const authError = await authorizeAdmin(request);
  return authError ?? legacyAdminDisabled();
}

export async function PATCH(request: Request) {
  const authError = await authorizeAdmin(request);
  return authError ?? legacyAdminDisabled();
}
