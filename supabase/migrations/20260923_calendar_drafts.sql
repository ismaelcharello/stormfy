-- O calendário reutiliza tarefas do tipo Reunião; não cria uma segunda fonte de dados.
-- Esta migration adiciona somente o estado de rascunho dos cards e a permissão
-- necessária para excluir oportunidades com a RLS já existente.

alter table public.opportunities
  add column if not exists is_draft boolean not null default false;

grant select, insert, update, delete on public.opportunities to authenticated;
revoke all on public.opportunities from anon;

