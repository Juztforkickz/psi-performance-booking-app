import {
  ACCOUNT_RESPONSE_HEADERS,
  CUSTOMER_ACCOUNT_CAPABILITIES,
} from "../../../../lib/customer-account-foundation";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { account: CUSTOMER_ACCOUNT_CAPABILITIES },
    { headers: ACCOUNT_RESPONSE_HEADERS },
  );
}
