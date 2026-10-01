-- Apply after schema.sql and the calendar_drafts migration. All tables exposed
-- through PostgREST use RLS. This upgrade preserves commercial records.
alter table public.workspace_members drop constraint if exists workspace_members_role_check;
alter table public.workspace_members add column if not exists display_name text;
alter table public.workspace_members add column if not exists email text;
update public.workspace_members set role = 'superadmin' where role = 'owner';
alter table public.workspace_members add constraint workspace_members_role_check
  check (role in ('superadmin','admin','member','reader'));
alter table public.workspace_members alter column role set default 'member';
-- Provision the first admin's confirmed e-mail through the Supabase SQL Editor
-- before anyone can create a workspace. No email or password is embedded here.
create table public.bootstrap_authorizations (
 email text primary key check(position('@' in email)>1),
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.bootstrap_authorizations enable row level security;
revoke all on public.bootstrap_authorizations from public,anon,authenticated;
update public.workspace_members m set email = lower(u.email), display_name = coalesce(u.raw_user_meta_data->>'full_name',u.email)
  from auth.users u where m.user_id = u.id and m.email is null;

alter table public.workspace_invites add column if not exists role text not null default 'member';
alter table public.workspace_invites add column if not exists revoked_at timestamptz;
alter table public.workspace_invites add constraint workspace_invites_role_check
  check (role in ('superadmin','admin','member','reader'));

-- Fixed search_path and caller identity check: only membership of current
-- authenticated user is disclosed. This avoids recursive membership RLS.
create or replace function public.is_workspace_member(p_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace and m.user_id = (select auth.uid()));
$$;
create or replace function public.workspace_role(p_workspace uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when (select auth.uid()) is null then null else (
    select m.role from public.workspace_members m
    where m.workspace_id = p_workspace and m.user_id = (select auth.uid())) end;
$$;
revoke all on function public.is_workspace_member(uuid), public.workspace_role(uuid) from public, anon;
grant execute on function public.is_workspace_member(uuid), public.workspace_role(uuid) to authenticated;

drop policy if exists members_read_self on public.workspace_members;
create policy members_read_workspace on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));
drop policy if exists workspace_update_for_owner on public.workspaces;
revoke update on public.workspaces from authenticated;

drop policy if exists companies_workspace_access on public.companies;
drop policy if exists contacts_workspace_access on public.contacts;
drop policy if exists opportunities_workspace_access on public.opportunities;
drop policy if exists tasks_workspace_access on public.tasks;
drop policy if exists interactions_workspace_access on public.interactions;
do $$ declare t text; begin
  foreach t in array array['companies','contacts','opportunities','tasks','interactions'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))', t||'_read',t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.workspace_role(workspace_id) in (''superadmin'',''admin'',''member''))', t||'_insert',t);
    execute format('create policy %I on public.%I for update to authenticated using (public.workspace_role(workspace_id) in (''superadmin'',''admin'',''member'')) with check (public.workspace_role(workspace_id) in (''superadmin'',''admin'',''member''))', t||'_update',t);
  end loop;
end $$;
-- Only business cards, and archived activities below, support hard deletion.
create policy opportunities_delete on public.opportunities for delete to authenticated
  using (public.workspace_role(workspace_id) in ('superadmin','admin','member'));
create policy tasks_delete on public.tasks for delete to authenticated
  using (kind = 'Reunião' and public.workspace_role(workspace_id) in ('superadmin','admin'));

drop policy if exists invites_owner_read on public.workspace_invites;
drop policy if exists invites_owner_insert on public.workspace_invites;
create policy invites_admin_read on public.workspace_invites for select to authenticated
  using (public.workspace_role(workspace_id) in ('superadmin','admin'));
create policy invites_admin_insert on public.workspace_invites for insert to authenticated
  with check (created_by = (select auth.uid()) and expires_at <= now() + interval '7 days 10 minutes'
    and (public.workspace_role(workspace_id) = 'superadmin'
      or (public.workspace_role(workspace_id) = 'admin' and role in ('member','reader'))));
create or replace function public.revoke_team_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_invite public.workspace_invites%rowtype;
begin
 if v_user is null then raise exception 'Autenticação necessária'; end if;
 select * into v_invite from public.workspace_invites where id=p_invite and used_at is null for update;
 if not found or public.workspace_role(v_invite.workspace_id) not in ('superadmin','admin') then raise exception 'Sem permissão'; end if;
 update public.workspace_invites set revoked_at=now() where id=p_invite;
 insert into public.team_audit(workspace_id,actor_id,action,detail) values(v_invite.workspace_id,v_user,'invite_revoked',v_invite.invitee_email);
end; $$;

create or replace function public.create_workspace_for_current_user(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_workspace_id uuid; v_email text;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Autenticação necessária'; end if;
  select lower(email) into v_email from auth.users u where u.id=v_user_id and u.email_confirmed_at is not null;
  if v_email is null then raise exception 'Confirme seu e-mail'; end if;
  if p_name is null or length(trim(p_name)) not between 2 and 100 then raise exception 'Nome inválido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(74231909);
  if exists (select 1 from public.workspaces) then raise exception 'Solicite um convite'; end if;
  if not exists(select 1 from public.bootstrap_authorizations b where b.email=v_email and b.consumed_at is null) then raise exception 'Este e-mail não está autorizado para a configuração inicial'; end if;
  insert into public.workspaces(name,owner_id) values(trim(p_name),v_user_id) returning id into v_workspace_id;
  insert into public.workspace_members(workspace_id,user_id,role,email,display_name)
    select v_workspace_id,v_user_id,'superadmin',lower(u.email),coalesce(u.raw_user_meta_data->>'full_name',u.email)
    from auth.users u where u.id=v_user_id;
  update public.bootstrap_authorizations set consumed_at=now() where email=v_email;
  return v_workspace_id;
end; $$;

create or replace function public.workspace_bootstrap_available()
returns boolean language sql stable security definer set search_path = '' as $$
 select not exists(select 1 from public.workspaces) and exists(select 1 from public.bootstrap_authorizations where consumed_at is null);
$$;
-- Only the boolean availability is public; no records or identities are exposed.
grant execute on function public.workspace_bootstrap_available() to anon;

create or replace function public.join_workspace_by_invite(p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid := auth.uid(); v_invite public.workspace_invites%rowtype; v_user auth.users%rowtype;
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'Autenticação necessária'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Convite inválido'; end if;
  select * into v_user from auth.users where id=v_user_id;
  if v_user.email_confirmed_at is null then raise exception 'Confirme seu e-mail'; end if;
  if exists(select 1 from public.workspace_members where user_id=v_user_id) then raise exception 'Usuário já pertence a uma equipe'; end if;
  select * into v_invite from public.workspace_invites
    where token_hash=p_token_hash and used_at is null and revoked_at is null and expires_at>now() for update;
  if not found or lower(v_user.email) <> lower(v_invite.invitee_email) then raise exception 'Convite inválido, expirado ou para outro e-mail'; end if;
  insert into public.workspace_members(workspace_id,user_id,role,email,display_name)
    values(v_invite.workspace_id,v_user_id,v_invite.role,lower(v_user.email),coalesce(v_user.raw_user_meta_data->>'full_name',v_user.email));
  update public.workspace_invites set used_at=now(),used_by=v_user_id where id=v_invite.id;
  insert into public.team_audit(workspace_id,actor_id,target_id,action,detail)
    values(v_invite.workspace_id,v_user_id,v_user_id,'invite_accepted',v_invite.invitee_email);
  return v_invite.workspace_id;
end; $$;

create table if not exists public.team_audit (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null, target_id uuid,
 action text not null, detail text, created_at timestamptz not null default now()
);
alter table public.team_audit enable row level security;
create policy team_audit_read on public.team_audit for select to authenticated
 using (public.workspace_role(workspace_id) in ('superadmin','admin'));

-- Every invitation is logged server-side. Client code cannot insert audit rows.
create or replace function public.log_invite_created() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.team_audit(workspace_id,actor_id,action,detail)
 values(new.workspace_id,new.created_by,'invite_created',new.invitee_email);
 return new;
end; $$;
create trigger invite_created_audit after insert on public.workspace_invites
 for each row execute function public.log_invite_created();

-- Sensitive role mutations are serialized and performed only by this RPC.
-- Admins cannot grant admin/superadmin; no caller can change their own role.
create or replace function public.change_team_role(p_workspace uuid,p_member uuid,p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_actor_role text; v_old_role text;
begin
 if v_actor is null then raise exception 'Autenticação necessária'; end if;
 select role into v_actor_role from public.workspace_members where workspace_id=p_workspace and user_id=v_actor;
 if v_actor_role not in ('superadmin','admin') or v_actor=p_member then raise exception 'Sem permissão'; end if;
 if p_role not in ('superadmin','admin','member','reader') then raise exception 'Papel inválido'; end if;
 if v_actor_role='admin' and p_role in ('superadmin','admin') then raise exception 'Sem permissão'; end if;
 select role into v_old_role from public.workspace_members where workspace_id=p_workspace and user_id=p_member for update;
 if v_old_role is null then raise exception 'Membro não encontrado'; end if;
 if v_actor_role='admin' and v_old_role in ('superadmin','admin') then raise exception 'Sem permissão'; end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 if v_old_role='superadmin' and p_role<>'superadmin' and (select count(*) from public.workspace_members where workspace_id=p_workspace and role='superadmin')<=1 then raise exception 'O último superadministrador não pode ser rebaixado'; end if;
 update public.workspace_members set role=p_role where workspace_id=p_workspace and user_id=p_member;
 insert into public.team_audit(workspace_id,actor_id,target_id,action,detail) values(p_workspace,v_actor,p_member,'role_changed',v_old_role||' → '||p_role);
end; $$;

create or replace function public.remove_team_member(p_workspace uuid,p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_actor_role text; v_old_role text;
begin
 if v_actor is null or v_actor=p_member then raise exception 'Sem permissão'; end if;
 select role into v_actor_role from public.workspace_members where workspace_id=p_workspace and user_id=v_actor;
 select role into v_old_role from public.workspace_members where workspace_id=p_workspace and user_id=p_member for update;
 if v_actor_role not in ('superadmin','admin') or v_old_role is null or (v_actor_role='admin' and v_old_role in ('admin','superadmin')) then raise exception 'Sem permissão'; end if;
 perform 1 from public.workspaces where id=p_workspace for update;
 if v_old_role='superadmin' and (select count(*) from public.workspace_members where workspace_id=p_workspace and role='superadmin')<=1 then raise exception 'O último superadministrador não pode ser removido'; end if;
 delete from public.workspace_members where workspace_id=p_workspace and user_id=p_member;
 insert into public.team_audit(workspace_id,actor_id,target_id,action,detail) values(p_workspace,v_actor,p_member,'member_removed',v_old_role);
end; $$;

alter table public.tasks add column if not exists end_at timestamptz;
alter table public.tasks add column if not exists location text;
alter table public.tasks add column if not exists archived_at timestamptz;
alter table public.tasks add column if not exists meeting_status text;
alter table public.tasks add constraint tasks_meeting_status_check check (meeting_status is null or meeting_status in ('Rascunho','Agendada','Realizada','Cancelada'));
alter table public.tasks add constraint tasks_end_after_start check (end_at is null or end_at > due_at);
alter table public.tasks drop constraint if exists tasks_need_a_record;
alter table public.tasks add constraint tasks_need_a_record check (kind='Reunião' or contact_id is not null or opportunity_id is not null);

create table public.activity_columns (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 title text not null check(length(trim(title)) between 1 and 80), position numeric not null default 0,
 archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,workspace_id)
);
create unique index if not exists opportunities_id_workspace_unique on public.opportunities(id,workspace_id);
create table public.board_activities (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 column_id uuid not null, title text not null check(length(trim(title)) between 1 and 200), description text,
 assigned_to text, priority text not null default 'Média' check(priority in ('Baixa','Média','Alta','Urgente')),
 start_at timestamptz, due_at timestamptz, labels jsonb not null default '[]' check(jsonb_typeof(labels)='array'),
 checklist jsonb not null default '[]' check(jsonb_typeof(checklist)='array'),
 contact_id uuid, company_id uuid, opportunity_id uuid, created_by uuid not null default auth.uid() references auth.users(id),
 status text not null default 'published' check(status in ('draft','published','archived')),
 position numeric not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,workspace_id),
 constraint board_column_workspace foreign key(column_id,workspace_id) references public.activity_columns(id,workspace_id),
 constraint board_contact_workspace foreign key(contact_id,workspace_id) references public.contacts(id,workspace_id) on delete set null (contact_id),
 constraint board_company_workspace foreign key(company_id,workspace_id) references public.companies(id,workspace_id) on delete set null (company_id),
 constraint board_opportunity_workspace foreign key(opportunity_id,workspace_id) references public.opportunities(id,workspace_id) on delete set null (opportunity_id)
);
create table public.activity_comments (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 activity_id uuid not null, author_id uuid not null default auth.uid() references auth.users(id), author_name text not null,
 body text not null check(length(trim(body)) between 1 and 5000), created_at timestamptz not null default now(),
 constraint activity_comments_workspace foreign key(activity_id,workspace_id) references public.board_activities(id,workspace_id) on delete cascade
);
create table public.activity_audit (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 activity_id uuid, actor_id uuid, action text not null, detail text, created_at timestamptz not null default now()
);
create index board_activities_workspace_column on public.board_activities(workspace_id,column_id,position);
create index board_activities_due on public.board_activities(workspace_id,due_at) where status='published';
create index activity_comments_activity on public.activity_comments(activity_id,created_at);
create trigger activity_columns_updated_at before update on public.activity_columns for each row execute function public.set_updated_at();
create trigger board_activities_updated_at before update on public.board_activities for each row execute function public.set_updated_at();

create or replace function public.seed_activity_columns() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.activity_columns(workspace_id,title,position)
 values(new.id,'Caixa de entrada',0),(new.id,'A fazer',1),(new.id,'Em andamento',2),(new.id,'Em revisão',3),(new.id,'Concluído',4);
 return new;
end; $$;
create trigger workspace_default_columns after insert on public.workspaces for each row execute function public.seed_activity_columns();
insert into public.activity_columns(workspace_id,title,position)
select w.id,c.title,c.position from public.workspaces w cross join (values ('Caixa de entrada',0),('A fazer',1),('Em andamento',2),('Em revisão',3),('Concluído',4)) c(title,position)
where not exists(select 1 from public.activity_columns a where a.workspace_id=w.id);

-- Immutable history, generated by the database, never trusted from a client.
create or replace function public.log_board_activity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.activity_audit(workspace_id,activity_id,actor_id,action,detail)
 values(coalesce(new.workspace_id,old.workspace_id),coalesce(new.id,old.id),auth.uid(),tg_op,
   case when tg_op='UPDATE' then 'Coluna/status: '||old.column_id||'/'||old.status||' → '||new.column_id||'/'||new.status else null end);
 return coalesce(new,old);
end; $$;
create trigger board_activity_history after insert or update or delete on public.board_activities for each row execute function public.log_board_activity();

alter table public.activity_columns enable row level security;
alter table public.board_activities enable row level security;
alter table public.activity_comments enable row level security;
alter table public.activity_audit enable row level security;
create policy activity_columns_read on public.activity_columns for select to authenticated using(public.is_workspace_member(workspace_id));
create policy activity_columns_insert on public.activity_columns for insert to authenticated with check(public.workspace_role(workspace_id) in ('superadmin','admin','member'));
create policy activity_columns_update on public.activity_columns for update to authenticated using(public.workspace_role(workspace_id) in ('superadmin','admin','member')) with check(public.workspace_role(workspace_id) in ('superadmin','admin','member'));
create policy board_activities_read on public.board_activities for select to authenticated
 using(public.is_workspace_member(workspace_id) and (status <> 'draft' or created_by=(select auth.uid()) or public.workspace_role(workspace_id)='superadmin'));
create policy board_activities_insert on public.board_activities for insert to authenticated
 with check(public.workspace_role(workspace_id) in ('superadmin','admin','member') and created_by=(select auth.uid()));
create policy board_activities_update on public.board_activities for update to authenticated
 using(public.workspace_role(workspace_id) in ('superadmin','admin','member') and (status<>'draft' or created_by=(select auth.uid()) or public.workspace_role(workspace_id)='superadmin'))
 with check(public.workspace_role(workspace_id) in ('superadmin','admin','member') and (status<>'draft' or created_by=(select auth.uid()) or public.workspace_role(workspace_id)='superadmin'));
create policy board_activities_delete on public.board_activities for delete to authenticated
 using(public.workspace_role(workspace_id) in ('superadmin','admin') or created_by=(select auth.uid()));
create policy activity_comments_read on public.activity_comments for select to authenticated using(public.is_workspace_member(workspace_id) and exists(select 1 from public.board_activities a where a.id=activity_id));
create policy activity_comments_insert on public.activity_comments for insert to authenticated
 with check(public.workspace_role(workspace_id) in ('superadmin','admin','member') and author_id=(select auth.uid()) and exists(select 1 from public.board_activities a where a.id=activity_id));
create policy activity_audit_read on public.activity_audit for select to authenticated using(public.is_workspace_member(workspace_id));

grant select on public.workspace_members,public.team_audit,public.activity_audit to authenticated;
grant select,insert on public.workspace_invites to authenticated;
revoke update on public.workspace_invites from authenticated;
grant select,insert,update on public.activity_columns to authenticated;
grant select,insert,update,delete on public.board_activities to authenticated;
grant select,insert on public.activity_comments to authenticated;
grant select,insert,update on public.companies,public.contacts to authenticated;
grant select,insert,update,delete on public.tasks to authenticated;
grant select,insert,update,delete on public.opportunities to authenticated;
grant select,insert,update on public.interactions to authenticated;
revoke all on public.team_audit,public.activity_columns,public.board_activities,public.activity_comments,public.activity_audit from anon;
revoke all on function public.change_team_role(uuid,uuid,text),public.remove_team_member(uuid,uuid),public.revoke_team_invite(uuid),public.seed_activity_columns(),public.log_board_activity(),public.log_invite_created() from public,anon;
grant execute on function public.change_team_role(uuid,uuid,text),public.remove_team_member(uuid,uuid),public.revoke_team_invite(uuid) to authenticated;

-- Explicitly deny invoking trigger internals as public RPCs.
revoke all on function public.seed_activity_columns(),public.log_board_activity(),public.log_invite_created() from authenticated;
