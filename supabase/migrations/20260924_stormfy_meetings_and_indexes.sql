-- Stormfy MVP hardening: richer calendar records and query indexes.
-- This is additive and preserves existing commercial data.

-- A meeting may be linked directly to a company and keep its operational
-- context without duplicating CRM records. Composite FK prevents cross-
-- workspace references.
alter table public.tasks add column if not exists company_id uuid;
alter table public.tasks add column if not exists participants text[] not null default '{}';
alter table public.tasks add column if not exists agenda text;
alter table public.tasks add column if not exists reminder_at timestamptz;
alter table public.tasks drop constraint if exists tasks_company_same_workspace;
alter table public.tasks add constraint tasks_company_same_workspace
  foreign key (company_id, workspace_id) references public.companies(id, workspace_id)
  on delete set null (company_id);

-- The former migration added a second copy of the composite opportunity key.
drop index if exists public.opportunities_id_workspace_unique;

create index if not exists contacts_workspace_company on public.contacts(workspace_id, company_id);
create index if not exists opportunities_workspace_company on public.opportunities(workspace_id, company_id);
create index if not exists opportunities_workspace_contact on public.opportunities(workspace_id, contact_id);
create index if not exists tasks_workspace_contact on public.tasks(workspace_id, contact_id);
create index if not exists tasks_workspace_opportunity on public.tasks(workspace_id, opportunity_id);
create index if not exists tasks_workspace_company on public.tasks(workspace_id, company_id);
create index if not exists tasks_workspace_meeting on public.tasks(workspace_id, due_at)
  where kind = 'Reunião' and archived_at is null;
create index if not exists interactions_workspace_contact on public.interactions(workspace_id, contact_id, occurred_at desc);
create index if not exists interactions_workspace_opportunity on public.interactions(workspace_id, opportunity_id, occurred_at desc);
create index if not exists workspace_invites_workspace on public.workspace_invites(workspace_id, expires_at desc);
create index if not exists workspace_members_user on public.workspace_members(user_id, workspace_id);

-- Explicitly deny direct Data API access to bootstrap e-mail authorizations.
-- SECURITY DEFINER setup functions are the only intended access path.
drop policy if exists bootstrap_authorizations_no_client_access on public.bootstrap_authorizations;
create policy bootstrap_authorizations_no_client_access on public.bootstrap_authorizations
  for all to anon, authenticated using (false) with check (false);
