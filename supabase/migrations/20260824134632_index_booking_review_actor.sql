create index booking_requests_reviewed_by_idx
  on public.booking_requests (reviewed_by)
  where reviewed_by is not null;
