create index customer_car_listings_created_by_idx
on public.customer_car_listings (created_by);

create index car_sale_email_jobs_recipient_idx
on public.car_sale_email_jobs (recipient_user_id, created_at desc);
