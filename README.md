# Stormfy CRM

CRM comercial em TypeScript, Next.js/Vinext e Supabase. A interface contém Dashboard, Contatos, Empresas, Funil, Tarefas, Atividades, Calendário e Equipe. O Site abre na área de acesso do CRM, sem página pública de marketing.

## Estado da implantação

Sem `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, o aplicativo entra em **demonstração local**. Nesse estado, a interface salva no navegador atual, mas os registros não são compartilhados com a equipe e as contas/convites não funcionam. O aviso de acesso local permanece visível no CRM. Não use essa versão como banco compartilhado.

Com Supabase configurado e as migrations aplicadas, o CRM usa Supabase Auth, Postgres e RLS. Para migrar contatos já inseridos no mesmo navegador antes da conexão, a tela de Contatos oferece a importação local para o workspace; confirme os dados e evite repetir o processo em vários navegadores.

## Ativar acesso compartilhado

1. Crie um projeto Supabase dedicado. Configure Auth com confirmação de e-mail, `Site URL` e URLs de redirecionamento para o endereço publicado no Sites.
2. Aplique `supabase/schema.sql`, depois `supabase/migrations/20260923_calendar_drafts.sql` e `supabase/migrations/20260924_stormfy_team_activities.sql`, nessa ordem, em um banco novo. Em um banco existente, verifique o histórico antes de aplicar as migrations: preserve dados e não execute `schema.sql` pela segunda vez.
3. No SQL Editor, autorize o e-mail **confirmado** do primeiro superadministrador, informado pelo próprio administrador, usando `insert into public.bootstrap_authorizations(email) values (lower('EMAIL_CONFIRMADO_AQUI'));`. Nunca coloque e-mail, senha ou `service_role` no código do navegador.
4. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como variáveis de build/deploy do Sites. O exemplo sem valores reais está em `.env.example`. Publique novamente o Site para incorporar essas variáveis.
5. O usuário autorizado cria a conta e o workspace. Pela tela Equipe, convide o e-mail que Rudy usar na conta dele com papel **Superadministrador**. Rudy confirma seu e-mail e aceita o convite individual de uso único, válido por sete dias.

Após a ativação, outros usuários só entram no workspace mediante convite para o mesmo e-mail confirmado. Papéis e associação ao workspace são checados no banco; o nome escolhido no formulário não concede privilégios.

## Funcionalidades e limites

- Empresas e contatos com criação, edição, busca, filtros e arquivamento. Consultas Supabase usam páginas de 10 registros até trazer todos; a lista não para silenciosamente no décimo contato.
- Funil em oito etapas, edição, rascunhos e exclusão confirmada de cards.
- Tarefas e follow-ups, interações vinculadas aos registros comerciais.
- Reuniões no mesmo registro de tarefas, com visões mês/semana/dia, rascunhos e alerta de conflito do responsável.
- Quadro de atividades com colunas, cartões, comentários, checklist, rascunhos, movimentação por controle ou arrastar e auditoria no banco.
- Dashboard derivado dos registros da carteira, com filtros e atalhos.
- Equipe com convites vinculados a e-mail confirmado e papéis Superadministrador, Administrador, Membro e Leitor.

WhatsApp abre um link externo, sem envio automático. As informações dos contatos iniciais são apenas as fornecidas por Ismael.

## Código

- `app/crm-app.tsx`: sessão, fluxos de gravação e navegação.
- `components/crm/views.tsx`: dashboard, carteira, funil, tarefas e calendário.
- `components/crm/activity-board.tsx`: quadro Kanban.
- `components/crm/team-management.tsx`: papéis, membros e convites.
- `lib/crm-repository.ts`: leitura paginada e escopo do workspace.
- `supabase/schema.sql` e `supabase/migrations/`: banco e políticas RLS.

Verifique localmente com `pnpm lint`, `pnpm exec tsc --noEmit` e `pnpm build`. Os testes de autenticação, RLS e persistência em dispositivos distintos exigem um projeto Supabase configurado e duas contas reais; build sozinho não os comprova.
