-- A ata original fica privada e só pode ser acessada pela equipe da empresa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meeting-minutes', 'meeting-minutes', false, 8388608, array['application/pdf'])
on conflict (id) do nothing;

create policy "Team members can read meeting minutes"
on storage.objects for select to authenticated
using (
  bucket_id = 'meeting-minutes'
  and exists (
    select 1 from public.workspace_members m
    where m.user_id = (select auth.uid())
      and m.workspace_id::text = split_part(name, '/', 1)
  )
);

create policy "Editors can upload meeting minutes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'meeting-minutes'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
  and exists (
    select 1 from public.workspace_members m
    join public.companies c on c.workspace_id = m.workspace_id
    where m.user_id = (select auth.uid()) and m.role <> 'reader'
      and m.workspace_id::text = split_part(name, '/', 1)
      and c.id::text = split_part(name, '/', 2)
      and c.archived_at is null
  )
);

create policy "Editors can remove their unsaved meeting minutes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'meeting-minutes'
  and owner_id = (select auth.uid())::text
  and exists (
    select 1 from public.workspace_members m
    where m.user_id = (select auth.uid()) and m.role <> 'reader'
      and m.workspace_id::text = split_part(name, '/', 1)
  )
);
