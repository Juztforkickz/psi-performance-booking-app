import { PUBLIC_DEMO_SUBMISSIONS_DISABLED_ERROR } from "./public-demo";

export function publicDemoSubmissionsDisabledResponse() {
  return Response.json(PUBLIC_DEMO_SUBMISSIONS_DISABLED_ERROR, {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
