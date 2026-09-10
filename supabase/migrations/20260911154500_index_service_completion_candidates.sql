-- Cover the completion-candidate identity foreign keys used by Xero matching
-- and service-completion cleanup.
create index service_completion_candidates_job_idx
  on public.service_completion_candidates(job_id);

create index service_completion_candidates_job_customer_vehicle_idx
  on public.service_completion_candidates(job_id, customer_id, vehicle_id);
