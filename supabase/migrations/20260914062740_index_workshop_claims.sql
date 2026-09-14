create index workshop_contacts_claimed_by_idx
  on public.workshop_contacts (claimed_by)
  where claimed_by is not null;

create index workshop_jobs_workshop_vehicle_contact_idx
  on public.workshop_jobs (workshop_vehicle_id, workshop_contact_id)
  where workshop_vehicle_id is not null;
