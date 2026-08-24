-- The authenticated role already has SELECT on staff_members and the table's
-- RLS policy limits AAL1 reads to auth.uid() = user_id. The public
-- SECURITY DEFINER bootstrap RPC therefore adds no capability and is removed
-- so staff bootstrap uses the same least-privilege RLS path as other reads.

drop function if exists public.current_staff_access();
