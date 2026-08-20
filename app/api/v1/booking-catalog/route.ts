import { BOOKING_CATALOG } from "./catalog";

export async function GET() {
  return Response.json(BOOKING_CATALOG, {
    headers: { "Cache-Control": "no-store" },
  });
}
