import { customerAccountsDisabledResponse } from "../../../../lib/customer-account-foundation";

export const dynamic = "force-dynamic";

export function GET() {
  return customerAccountsDisabledResponse();
}

export function PATCH() {
  return customerAccountsDisabledResponse();
}
