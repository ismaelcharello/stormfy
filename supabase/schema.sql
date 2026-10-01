-- Stormfy CRM — schema inicial compartilhado com RLS por workspace.
-- Execute uma única vez em um projeto Supabase novo, via migration.
create extension if not exists pgcrypto with schema extensions;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  unique (user_id)
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  website text check (website is null or website ~* '^https?://'),
  instagram text check (instagram is null or instagram ~* '^https?://'),
  segment text,
  phone text,
  city text,
  observations text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create unique index companies_workspace_name_active on public.companies(workspace_id, lower(name)) where archived_at is null;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid,
  name text not null check (length(trim(name)) between 1 and 200),
  title text,
  phone text,
  whatsapp text,
  email text check (email is null or position('@' in email) > 1),
  instagram text check (instagram is null or instagram ~* '^https?://'),
  linkedin text check (linkedin is null or linkedin ~* '^https?://'),
  source text,
  assigned_to text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint contacts_company_same_workspace foreign key (company_id, workspace_id) references public.companies(id, workspace_id) on delete set null (company_id)
);
create index contacts_workspace_created on public.contacts(workspace_id, created_at desc);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  company_id uuid,
  contact_id uuid,
  stage text not null default 'Novo lead' check (stage in ('Novo lead','Primeiro contato','Qualificação','Reunião agendada','Proposta enviada','Negociação','Ganho','Perdido')),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  assigned_to text,
  source text,
  expected_close_at date,
  notes text,
  is_draft boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint opportunities_company_same_workspace foreign key (company_id, workspace_id) references public.companies(id, workspace_id) on delete set null (company_id),
  constraint opportunities_contact_same_workspace foreign key (contact_id, workspace_id) references public.contacts(id, workspace_id) on delete set null (contact_id)
);
create index opportunities_workspace_stage on public.opportunities(workspace_id, stage);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  kind text not null default 'Ligação' check (kind in ('Ligação','WhatsApp','E-mail','Reunião','Tarefa')),
  contact_id uuid,
  opportunity_id uuid,
  assigned_to text,
  due_at timestamptz not null,
  priority text not null default 'Média' check (priority in ('Baixa','Média','Alta')),
  status text not null default 'Pendente' check (status in ('Pendente','Concluída','Cancelada')),
  description text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_need_a_record check (contact_id is not null or opportunity_id is not null),
  constraint tasks_contact_same_workspace foreign key (contact_id, workspace_id) references public.contacts(id, workspace_id) on delete cascade,
  constraint tasks_opportunity_same_workspace foreign key (opportunity_id, workspace_id) references public.opportunities(id, workspace_id) on delete cascade
);
create index tasks_workspace_due on public.tasks(workspace_id, status, due_at);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid,
  opportunity_id uuid,
  kind text not null check (kind in ('Ligação','WhatsApp','E-mail','Reunião','Nota')),
  summary text not null check (length(trim(summary)) between 1 and 5000),
  result text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint interactions_need_a_record check (contact_id is not null or opportunity_id is not null),
  constraint interactions_contact_same_workspace foreign key (contact_id, workspace_id) references public.contacts(id, workspace_id) on delete cascade,
  constraint interactions_opportunity_same_workspace foreign key (opportunity_id, workspace_id) references public.opportunities(id, workspace_id) on delete cascade
);
create index interactions_workspace_occurred on public.interactions(workspace_id, occurred_at desc);

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invitee_email text not null check (length(trim(invitee_email)) between 6 and 254 and position('@' in invitee_email) > 1),
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint invite_expires_within_seven_days check (expires_at > created_at and expires_at <= created_at + interval '7 days 10 minutes')
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger companies_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger contacts_updated_at before update on public.contacts for each row execute function public.set_updated_at();
create trigger opportunities_updated_at before update on public.opportunities for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();

-- RPC de bootstrap: lock transacional impede dois primeiros workspaces concorrentes.
-- A página do Site permanece privada até o administrador criar o primeiro usuário.
create or replace function public.create_workspace_for_current_user(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
begin
  if v_user_id is null then raise exception 'Autenticação necessária'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then raise exception 'É necessário um usuário registrado'; end if;
  if not exists (select 1 from auth.users u where u.id = v_user_id and u.email_confirmed_at is not null)
  then raise exception 'Confirme seu e-mail antes de criar o CRM'; end if;
  if p_name is null or length(trim(p_name)) not between 2 and 100 then raise exception 'Nome do workspace inválido'; end if;
  perform pg_catalog.pg_advisory_xact_lock(74231909);
  if exists (select 1 from public.workspaces) then raise exception 'O CRM já foi ativado; solicite um convite ao administrador'; end if;
  if exists (select 1 from public.workspace_members where user_id = v_user_id) then raise exception 'Este usuário já pertence a um workspace'; end if;
  insert into public.workspaces(name, owner_id) values (trim(p_name), v_user_id) returning id into v_workspace_id;
  insert into public.workspace_members(workspace_id, user_id, role) values (v_workspace_id, v_user_id, 'owner');
  return v_workspace_id;
end;
$$;

-- Exibe a tela de criação inicial apenas enquanto o único workspace não existe.
create or replace function public.workspace_bootstrap_available()
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.workspaces);
$$;

-- Consome atomicamente convite de uso único: clientes nunca recebem a tabela exposta.
create or replace function public.join_workspace_by_invite(p_token_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.workspace_invites%rowtype;
begin
  if v_user_id is null then raise exception 'Autenticação necessária'; end if;
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then raise exception 'É necessário um usuário registrado'; end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Convite inválido'; end if;
  if exists (select 1 from public.workspace_members where user_id = v_user_id) then raise exception 'Este usuário já pertence a um workspace'; end if;
  select * into v_invite from public.workspace_invites
    where token_hash = p_token_hash and used_at is null and expires_at > now()
    for update;
  if not found then raise exception 'Convite inválido, expirado ou já utilizado'; end if;
  if not exists (select 1 from auth.users u where u.id = v_user_id
    and u.email_confirmed_at is not null
    and lower(u.email) = lower(v_invite.invitee_email))
  then raise exception 'Entre com o e-mail confirmado que recebeu o convite'; end if;
  perform 1 from public.workspaces where id = v_invite.workspace_id for update;
  if (select count(*) from public.workspace_members where workspace_id = v_invite.workspace_id) >= 2
  then raise exception 'Este CRM já possui os dois acessos autorizados'; end if;
  insert into public.workspace_members(workspace_id, user_id, role) values (v_invite.workspace_id, v_user_id, 'member');
  update public.workspace_invites set used_at = now(), used_by = v_user_id where id = v_invite.id;
  return v_invite.workspace_id;
end;
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.opportunities enable row level security;
alter table public.tasks enable row level security;
alter table public.interactions enable row level security;
alter table public.workspace_invites enable row level security;

create policy workspace_read_for_members on public.workspaces for select to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = id and m.user_id = (select auth.uid())));
create policy workspace_update_for_owner on public.workspaces for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy members_read_self on public.workspace_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy companies_workspace_access on public.companies for all to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = companies.workspace_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = companies.workspace_id and m.user_id = (select auth.uid())));
create policy contacts_workspace_access on public.contacts for all to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = contacts.workspace_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = contacts.workspace_id and m.user_id = (select auth.uid())));
create policy opportunities_workspace_access on public.opportunities for all to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = opportunities.workspace_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = opportunities.workspace_id and m.user_id = (select auth.uid())));
create policy tasks_workspace_access on public.tasks for all to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = tasks.workspace_id and m.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workspace_members m where m.workspace_id = tasks.workspace_id and m.user_id = (select auth.uid())));
create policy interactions_workspace_access on public.interactions for all to authenticated
  using (exists (select 1 from public.workspace_members m where m.workspace_id = interactions.workspace_id and m.user_id = (select auth.uid())))
  with check (created_by = (select auth.uid()) and exists (select 1 from public.workspace_members m where m.workspace_id = interactions.workspace_id and m.user_id = (select auth.uid())));
create policy invites_owner_read on public.workspace_invites for select to authenticated
  using (created_by = (select auth.uid()));
create policy invites_owner_insert on public.workspace_invites for insert to authenticated
  with check (created_by = (select auth.uid()) and expires_at <= now() + interval '7 days 10 minutes' and exists (
    select 1 from public.workspaces w where w.id = workspace_invites.workspace_id and w.owner_id = (select auth.uid())
  ));

-- Explicit grants: Supabase projects created in 2026 do not necessarily grant public-schema tables by default.
grant usage on schema public to authenticated;
grant select, update on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;
grant select, insert, update on public.companies, public.contacts, public.tasks to authenticated;
grant select, insert, update, delete on public.opportunities to authenticated;
grant select, insert on public.interactions to authenticated;
grant select, insert on public.workspace_invites to authenticated;
revoke all on public.workspaces, public.workspace_members, public.companies, public.contacts, public.opportunities, public.tasks, public.interactions, public.workspace_invites from anon;
revoke all on function public.create_workspace_for_current_user(text) from public, anon;
revoke all on function public.join_workspace_by_invite(text) from public, anon;
revoke all on function public.workspace_bootstrap_available() from public, anon;
grant execute on function public.create_workspace_for_current_user(text) to authenticated;
grant execute on function public.join_workspace_by_invite(text) to authenticated;
grant execute on function public.workspace_bootstrap_available() to authenticated;
