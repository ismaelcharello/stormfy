-- Diagnósticos de visitas. Uma empresa pode ter vários diagnósticos, inclusive rascunhos.
-- Interações, oportunidades e tarefas continuam nas tabelas originais do CRM.
alter table public.tasks drop constraint if exists tasks_need_a_record;
alter table public.tasks add constraint tasks_need_a_record
  check (kind='Reunião' or contact_id is not null or opportunity_id is not null or company_id is not null);
create table public.company_diagnostics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null,
  contact_id uuid,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  status text not null check (status in ('draft','completed','archived')),
  relationship_status text not null default 'Em relacionamento'
    check (relationship_status in ('Novo contato','Em relacionamento','Follow-up pendente','Oportunidade identificada','Reunião agendada','Cliente','Sem avanço')),
  potential text check (potential is null or potential in ('Baixo','Médio','Alto')),
  responsible text,
  visit_at timestamptz not null default now(),
  visit_kind text not null default 'Visita presencial'
    check (visit_kind in ('Visita presencial','Café','Reunião','Ligação','Evento','WhatsApp','Outro')),
  attendees text,
  location text,
  summary text not null default '',
  business_details jsonb not null default '{}'::jsonb check (jsonb_typeof(business_details) = 'object'),
  pains jsonb not null default '[]'::jsonb check (jsonb_typeof(pains) = 'array'),
  desires jsonb not null default '[]'::jsonb check (jsonb_typeof(desires) = 'array'),
  ideas jsonb not null default '[]'::jsonb check (jsonb_typeof(ideas) = 'array'),
  next_action text,
  next_kind text,
  next_due_at timestamptz,
  next_assigned_to text,
  next_priority text check (next_priority is null or next_priority in ('Baixa','Média','Alta')),
  next_notes text,
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id),
  constraint diagnostic_company_workspace foreign key(company_id,workspace_id)
    references public.companies(id,workspace_id) on delete cascade,
  constraint diagnostic_contact_workspace foreign key(contact_id,workspace_id)
    references public.contacts(id,workspace_id) on delete set null (contact_id),
  constraint diagnostic_completed_summary check(status <> 'completed' or length(trim(summary)) > 0)
);
create index company_diagnostics_company_visit on public.company_diagnostics(workspace_id,company_id,visit_at desc);
create index company_diagnostics_attention on public.company_diagnostics(workspace_id,status,next_due_at);

create table public.company_diagnostic_audit (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  diagnostic_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check(action in ('created','updated','completed','archived')),
  changed_at timestamptz not null default now(),
  constraint diagnostic_audit_parent foreign key(diagnostic_id,workspace_id)
    references public.company_diagnostics(id,workspace_id) on delete cascade
);
create index company_diagnostic_audit_recent on public.company_diagnostic_audit(workspace_id,diagnostic_id,changed_at desc);

alter table public.company_diagnostics enable row level security;
alter table public.company_diagnostic_audit enable row level security;
revoke all on public.company_diagnostics, public.company_diagnostic_audit from public, anon, authenticated;
grant select on public.company_diagnostics, public.company_diagnostic_audit to authenticated;

-- Um rascunho é privado ao autor e aos superadministradores; diagnósticos concluídos são da equipe.
create policy diagnostics_read on public.company_diagnostics for select to authenticated
  using (public.is_workspace_member(workspace_id) and
    (status <> 'draft' or created_by = (select auth.uid()) or public.workspace_role(workspace_id) = 'superadmin'));
create policy diagnostic_audit_read on public.company_diagnostic_audit for select to authenticated
  using (exists(select 1 from public.company_diagnostics d
    where d.id=diagnostic_id and d.workspace_id=workspace_id));

-- Nenhum DML direto é concedido à API. A função valida o vínculo e executa
-- diagnóstico + tarefa em uma única transação, com audit trail e permissão do workspace.
create or replace function public.save_company_diagnostic(
  p_company_id uuid, p_data jsonb, p_id uuid default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_workspace uuid;
  v_role text;
  v_existing public.company_diagnostics%rowtype;
  v_id uuid;
  v_task uuid;
  v_contact uuid := nullif(p_data->>'contact_id','')::uuid;
  v_status text := coalesce(nullif(p_data->>'status',''),'draft');
  v_next text := nullif(trim(p_data->>'next_action'),'');
  v_due timestamptz := nullif(p_data->>'next_due_at','')::timestamptz;
  v_kind text := nullif(p_data->>'next_kind','');
  v_visit timestamptz := coalesce(nullif(p_data->>'visit_at','')::timestamptz,now());
  v_schedule boolean := coalesce((p_data->>'schedule_task')::boolean,false);
begin
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
    then raise exception 'Autenticação necessária'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Dados inválidos'; end if;
  select c.workspace_id into v_workspace from public.companies c
    where c.id=p_company_id and c.archived_at is null;
  if v_workspace is null then raise exception 'Empresa indisponível'; end if;
  v_role := public.workspace_role(v_workspace);
  if v_role not in ('superadmin','admin','member') then raise exception 'Sem permissão para salvar diagnóstico'; end if;
  if v_contact is not null and not exists
    (select 1 from public.contacts c where c.id=v_contact and c.company_id=p_company_id
      and c.workspace_id=v_workspace and c.archived_at is null)
    then raise exception 'O contato deve pertencer à empresa'; end if;
  if v_status not in ('draft','completed','archived') then raise exception 'Status inválido'; end if;
  if v_status='completed' and nullif(trim(p_data->>'summary'),'') is null
    then raise exception 'Descreva a conversa antes de concluir'; end if;
  if jsonb_typeof(coalesce(p_data->'business_details','{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_data->'pains','[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_data->'desires','[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_data->'ideas','[]'::jsonb)) <> 'array'
    then raise exception 'Listas ou detalhes inválidos'; end if;
  if v_schedule and v_status='completed' and (v_next is null or v_due is null)
    then raise exception 'Informe a ação e a data para agendar o retorno'; end if;

  if p_id is not null then
    select * into v_existing from public.company_diagnostics
      where id=p_id and company_id=p_company_id and workspace_id=v_workspace for update;
    if not found then raise exception 'Diagnóstico não encontrado nesta empresa'; end if;
    if v_existing.status='draft' and v_existing.created_by<>v_user and v_role<>'superadmin'
      then raise exception 'Este rascunho pertence a outro usuário'; end if;
    v_id := p_id;
    v_task := v_existing.task_id;
  end if;

  if p_id is null then
    insert into public.company_diagnostics
      (workspace_id,company_id,contact_id,created_by,updated_by,status,relationship_status,potential,responsible,
       visit_at,visit_kind,attendees,location,summary,business_details,pains,desires,ideas,
       next_action,next_kind,next_due_at,next_assigned_to,next_priority,next_notes)
    values
      (v_workspace,p_company_id,v_contact,v_user,v_user,v_status,
       coalesce(nullif(p_data->>'relationship_status',''),'Em relacionamento'),
       nullif(p_data->>'potential',''),nullif(trim(p_data->>'responsible'),''),
       v_visit,coalesce(nullif(p_data->>'visit_kind',''),'Visita presencial'),
       nullif(trim(p_data->>'attendees'),''),nullif(trim(p_data->>'location'),''),
       coalesce(p_data->>'summary',''),coalesce(p_data->'business_details','{}'::jsonb),
       coalesce(p_data->'pains','[]'::jsonb),coalesce(p_data->'desires','[]'::jsonb),
       coalesce(p_data->'ideas','[]'::jsonb),v_next,v_kind,v_due,
       nullif(trim(p_data->>'next_assigned_to'),''),
       nullif(p_data->>'next_priority',''),nullif(trim(p_data->>'next_notes'),''))
    returning id into v_id;
  else
    update public.company_diagnostics d set
      contact_id=v_contact, updated_by=v_user, status=v_status,
      relationship_status=coalesce(nullif(p_data->>'relationship_status',''),'Em relacionamento'),
      potential=nullif(p_data->>'potential',''),responsible=nullif(trim(p_data->>'responsible'),''),
      visit_at=v_visit,visit_kind=coalesce(nullif(p_data->>'visit_kind',''),'Visita presencial'),
      attendees=nullif(trim(p_data->>'attendees'),''),location=nullif(trim(p_data->>'location'),''),
      summary=coalesce(p_data->>'summary',''),business_details=coalesce(p_data->'business_details','{}'::jsonb),
      pains=coalesce(p_data->'pains','[]'::jsonb),desires=coalesce(p_data->'desires','[]'::jsonb),
      ideas=coalesce(p_data->'ideas','[]'::jsonb),next_action=v_next,next_kind=v_kind,
      next_due_at=v_due,next_assigned_to=nullif(trim(p_data->>'next_assigned_to'),''),
      next_priority=nullif(p_data->>'next_priority',''),next_notes=nullif(trim(p_data->>'next_notes'),''),
      updated_at=now()
    where d.id=v_id;
  end if;

  if v_schedule and v_status='completed' then
    if v_task is not null and exists(select 1 from public.tasks where id=v_task and status='Pendente') then
      update public.tasks set title=left(v_next,200),
        kind=case when v_kind in ('Ligação','WhatsApp','E-mail','Reunião','Tarefa') then v_kind else 'Tarefa' end,
        contact_id=v_contact,company_id=p_company_id,due_at=v_due,
        assigned_to=nullif(trim(p_data->>'next_assigned_to'),''),
        priority=coalesce(nullif(p_data->>'next_priority',''),'Média'),
        description=concat_ws(E'\n',case when v_kind not in ('Ligação','WhatsApp','E-mail','Reunião','Tarefa') then 'Tipo: '||v_kind end,
          nullif(trim(p_data->>'next_notes'),'')),updated_at=now()
      where id=v_task and workspace_id=v_workspace;
    else
      insert into public.tasks(workspace_id,title,kind,contact_id,company_id,due_at,assigned_to,priority,description)
      values(v_workspace,left(v_next,200),
        case when v_kind in ('Ligação','WhatsApp','E-mail','Reunião','Tarefa') then v_kind else 'Tarefa' end,
        v_contact,p_company_id,v_due,nullif(trim(p_data->>'next_assigned_to'),''),
        coalesce(nullif(p_data->>'next_priority',''),'Média'),
        concat_ws(E'\n',case when v_kind not in ('Ligação','WhatsApp','E-mail','Reunião','Tarefa') then 'Tipo: '||v_kind end,
          nullif(trim(p_data->>'next_notes'),'')))
      returning id into v_task;
    end if;
    update public.company_diagnostics set task_id=v_task where id=v_id;
  end if;
  insert into public.company_diagnostic_audit(workspace_id,diagnostic_id,actor_id,action)
  values(v_workspace,v_id,v_user,
    case when v_status='archived' then 'archived' when v_status='completed' and
      (p_id is null or v_existing.status<>'completed') then 'completed'
    when p_id is null then 'created' else 'updated' end);
  return v_id;
end;
$$;
revoke all on function public.save_company_diagnostic(uuid,jsonb,uuid) from public, anon;
grant execute on function public.save_company_diagnostic(uuid,jsonb,uuid) to authenticated;
