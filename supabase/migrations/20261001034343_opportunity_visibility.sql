-- Preserve existing workspace access. New personal records are visible only to their owner.
alter table public.opportunities
  add column visibility text not null default 'team' check (visibility in ('team','personal')),
  add column owner_user_id uuid default auth.uid(),
  add column next_step text,
  add constraint personal_opportunity_has_owner check (visibility <> 'personal' or owner_user_id is not null);

create index opportunities_workspace_owner on public.opportunities(workspace_id,owner_user_id) where visibility='personal';

-- Restrictive policies are ANDed with the existing workspace/role policies.
create policy opportunities_visibility_guard on public.opportunities
  as restrictive for all to authenticated
  using (visibility='team' or owner_user_id=(select auth.uid()))
  with check (visibility='team' or owner_user_id=(select auth.uid()));

-- Related records must not disclose a hidden opportunity through another screen.
create policy tasks_opportunity_visibility_guard on public.tasks
  as restrictive for all to authenticated
  using (opportunity_id is null or exists(select 1 from public.opportunities o where o.id=tasks.opportunity_id and o.workspace_id=tasks.workspace_id))
  with check (opportunity_id is null or exists(select 1 from public.opportunities o where o.id=tasks.opportunity_id and o.workspace_id=tasks.workspace_id));

create policy interactions_opportunity_visibility_guard on public.interactions
  as restrictive for all to authenticated
  using (opportunity_id is null or exists(select 1 from public.opportunities o where o.id=interactions.opportunity_id and o.workspace_id=interactions.workspace_id))
  with check (opportunity_id is null or exists(select 1 from public.opportunities o where o.id=interactions.opportunity_id and o.workspace_id=interactions.workspace_id));

create policy activities_opportunity_visibility_guard on public.board_activities
  as restrictive for all to authenticated
  using (opportunity_id is null or exists(select 1 from public.opportunities o where o.id=board_activities.opportunity_id and o.workspace_id=board_activities.workspace_id))
  with check (opportunity_id is null or exists(select 1 from public.opportunities o where o.id=board_activities.opportunity_id and o.workspace_id=board_activities.workspace_id));
