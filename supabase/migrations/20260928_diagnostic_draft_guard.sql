-- Rascunhos não podem ser arquivados diretamente. Somente diagnósticos já
-- concluídos podem ser arquivados e compartilhados com o workspace.
create function public.guard_diagnostic_draft_archive() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.status = 'draft' and new.status = 'archived' then
    raise exception 'Conclua o diagnóstico antes de arquivá-lo';
  end if;
  return new;
end;
$$;
create trigger guard_diagnostic_draft_archive
  before update on public.company_diagnostics for each row
  execute function public.guard_diagnostic_draft_archive();
revoke all on function public.guard_diagnostic_draft_archive() from public, anon, authenticated;
