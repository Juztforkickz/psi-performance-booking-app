-- Run only in an isolated review database. No real files or alerts are sent.
-- Everything, including temporary fixture identities, rolls back.
begin;

-- Exercise the production AAL2 contract without changing the sandbox review
-- identity configuration after this transaction ends.
create or replace function private.current_staff_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.staff_members
  where user_id = (select auth.uid()) and status = 'active'
    and (select auth.jwt() ->> 'aal') = 'aal2' limit 1
$$;

insert into public.staff_members(email,role,status)
values ('ask-psi-hardening-staff@example.invalid','owner','pending');
insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('b1111111-1111-4111-8111-111111111111','authenticated','authenticated','ask-psi-hardening-a@example.invalid',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('b2222222-2222-4222-8222-222222222222','authenticated','authenticated','ask-psi-hardening-b@example.invalid',now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('b3333333-3333-4333-8333-333333333333','authenticated','authenticated','ask-psi-hardening-staff@example.invalid',now(),'{"provider":"email","providers":["email"]}','{}',now(),now());

create temporary table ask_psi_delivery_fixture(conversation_id uuid,message_id uuid) on commit drop;
grant select,insert on ask_psi_delivery_fixture to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);

insert into ask_psi_delivery_fixture select * from public.open_ask_psi_conversation(null,null,'other','Private retry acceptance.','b4444444-4444-4444-8444-444444444444');
do $$
declare duplicate_result record;
begin
  select * into duplicate_result from public.open_ask_psi_conversation(null,null,'other','Private retry acceptance.','b4444444-4444-4444-8444-444444444444');
  if duplicate_result.conversation_id <> (select conversation_id from ask_psi_delivery_fixture)
    or (select count(*) from public.ask_psi_conversations where customer_id = auth.uid()) <> 1 then
    raise exception 'Retry created a duplicate conversation';
  end if;
  begin
    perform public.open_ask_psi_conversation(null,null,'other','Changed payload.','b4444444-4444-4444-8444-444444444444');
    raise exception 'Nonce accepted changed content';
  exception when invalid_parameter_value then null; end;
end
$$;

select public.send_ask_psi_message((select conversation_id from ask_psi_delivery_fixture),'Second message.','b5555555-5555-4555-8555-555555555555','text');
select public.send_ask_psi_message((select conversation_id from ask_psi_delivery_fixture),'Second message.','b5555555-5555-4555-8555-555555555555','text');

-- Storage metadata fixtures stay entirely inside this rolled back transaction.
insert into storage.objects(bucket_id,name,owner_id,metadata)
select 'ask-psi-media',auth.uid()::text || '/' || conversation_id::text || '/b6666666-6666-4666-8666-666666666666/photo.png',auth.uid()::text,'{"mimetype":"image/png","size":100}'::jsonb
from ask_psi_delivery_fixture;
select public.send_ask_psi_photo(conversation_id,'b6666666-6666-4666-8666-666666666666',null,'b7777777-7777-4777-8777-777777777777',auth.uid()::text || '/' || conversation_id::text || '/b6666666-6666-4666-8666-666666666666/photo.png','image/png',100,10,10)
from ask_psi_delivery_fixture;
select public.send_ask_psi_photo(conversation_id,'b6666666-6666-4666-8666-666666666666',null,'b7777777-7777-4777-8777-777777777777',auth.uid()::text || '/' || conversation_id::text || '/b6666666-6666-4666-8666-666666666666/photo.png','image/png',100,10,10)
from ask_psi_delivery_fixture;

do $$
begin
  if (select count(*) from public.ask_psi_messages where conversation_id = (select conversation_id from ask_psi_delivery_fixture)) <> 3 then raise exception 'Retry duplicated text or photo'; end if;
  if (select count(*) from public.ask_psi_attachments where message_id = 'b6666666-6666-4666-8666-666666666666') <> 1 then raise exception 'Photo registration failed'; end if;
  if not exists (select 1 from storage.objects where bucket_id = 'ask-psi-media' and name like '%/b6666666-6666-4666-8666-666666666666/photo.png') then raise exception 'Participant cannot read registered photo'; end if;
  begin
    perform public.send_ask_psi_photo(conversation_id,'b8888888-8888-4888-8888-888888888888',null,'b9999999-9999-4999-8999-999999999999',auth.uid()::text || '/' || conversation_id::text || '/b8888888-8888-4888-8888-888888888888/missing.png','image/png',100,null,null)
    from ask_psi_delivery_fixture;
    raise exception 'Invented upload was registered';
  exception when check_violation then null; end;
end
$$;

insert into storage.objects(bucket_id,name,owner_id,metadata)
select 'ask-psi-media',auth.uid()::text || '/' || conversation_id::text || '/baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/abandoned.png',auth.uid()::text,'{"mimetype":"image/png","size":100}'::jsonb
from ask_psi_delivery_fixture;
do $$
begin
  if not exists (select 1 from storage.objects where name like '%/baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/abandoned.png') then raise exception 'Uploader cannot SELECT a failed upload for Storage API cleanup'; end if;
end
$$;

select set_config('request.jwt.claims','{"sub":"b2222222-2222-4222-8222-222222222222","role":"authenticated","aal":"aal1"}',true);
do $$
begin
  if exists (select 1 from public.ask_psi_conversations where id = (select conversation_id from ask_psi_delivery_fixture))
    or exists (select 1 from storage.objects where name like '%/baaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/abandoned.png' or name like '%/b6666666-6666-4666-8666-666666666666/photo.png') then
    raise exception 'Another customer can access private chat or uploads';
  end if;
  begin
    perform public.mark_ask_psi_conversation_read(conversation_id,message_id) from ask_psi_delivery_fixture;
    raise exception 'Another customer marked the conversation read';
  exception when insufficient_privilege then null; end;
end
$$;

select set_config('request.jwt.claims','{"sub":"b3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal1"}',true);
do $$ begin
  if exists (select 1 from public.ask_psi_conversations where id = (select conversation_id from ask_psi_delivery_fixture)) then raise exception 'Staff bypassed AAL2'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"b3333333-3333-4333-8333-333333333333","role":"authenticated","aal":"aal2"}',true);

-- Read only the first loaded message. The newer text and photo must stay unread.
select public.mark_ask_psi_conversation_read(conversation_id,message_id) from ask_psi_delivery_fixture;
do $$
begin
  if (select count(*) from public.ask_psi_messages where conversation_id = (select conversation_id from ask_psi_delivery_fixture) and recipient_read_at is not null) <> 1 then raise exception 'Read receipt advanced beyond loaded content'; end if;
  if (select count(*) from public.ask_psi_email_jobs where conversation_id = (select conversation_id from ask_psi_delivery_fixture) and recipient_user_id = 'b3333333-3333-4333-8333-333333333333' and status = 'cancelled') <> 1 then raise exception 'Email cancellation crossed the read boundary'; end if;
end
$$;
select public.send_ask_psi_message(conversation_id,'PSI reply.','bccccccc-cccc-4ccc-8ccc-cccccccccccc','text') from ask_psi_delivery_fixture;
do $$
begin
  if (select count(*) from public.ask_psi_messages where conversation_id = (select conversation_id from ask_psi_delivery_fixture) and recipient_read_at is not null) <> 1 then raise exception 'Sending implied reading unseen messages'; end if;
end
$$;
select set_config('request.jwt.claims','{"sub":"b1111111-1111-4111-8111-111111111111","role":"authenticated","aal":"aal1"}',true);
select public.mark_ask_psi_conversation_read(conversation_id,(select id from public.ask_psi_messages where client_nonce = 'bccccccc-cccc-4ccc-8ccc-cccccccccccc')) from ask_psi_delivery_fixture;
do $$
begin
  if not exists (select 1 from public.ask_psi_messages where client_nonce = 'bccccccc-cccc-4ccc-8ccc-cccccccccccc' and recipient_read_at is not null) then raise exception 'Reply read time missing'; end if;
  begin
    update public.ask_psi_messages set recipient_read_at = now() where conversation_id = (select conversation_id from ask_psi_delivery_fixture);
    raise exception 'Customer can forge direct read receipts';
  exception when insufficient_privilege then null; end;
end
$$;

reset role;
select 'Ask PSI authenticated photo, retry, isolation and bounded read tests passed' as result;
rollback;
