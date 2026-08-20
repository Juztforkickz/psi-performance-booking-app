/**
 * Legacy pay-first endpoint. Kept as an explicit non-bypassable gate so old
 * web/native clients cannot create a checkout before PSI approves a date.
 */
export async function POST() {
  return Response.json(
    {
      error: {
        code: "APPROVAL_REQUIRED",
        message:
          "Submit a booking request first. PSI must review and approve the date before any deposit checkout can be created.",
      },
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
        Link: '</api/v1/booking-requests>; rel="successor-version"',
      },
    },
  );
}
