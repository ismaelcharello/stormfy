# Stormfy — evolução da experiência de relacionamento

## Auditoria e decisões

| Antes | Depois | Motivo |
| --- | --- | --- |
| Perfil com dados extensos na primeira aba | Resumo, próximo passo, dores, desejos e últimas interações; seis abas | Dar contexto antes dos detalhes |
| Reunião com muitos campos aparentes | Duas etapas, somente empresa/data/resumo obrigatórios, detalhes opcionais recolhidos | Registrar rapidamente |
| Renovação da sessão remontava o CRM | Carregamento depende do ID estável do usuário | Manter o formulário aberto ao voltar à página |
| Rascunho local sem identificação do usuário | Armazenamento versionado por workspace, usuário e contexto | Recuperação sem misturar contas |
| Falha de IA interrompia a entrada | Revisão manual disponível com arquivo preservado | Permitir continuar sem IA |
| Dashboard com muitos indicadores equivalentes | “Seu foco hoje” com até cinco ações e indicadores úteis | Priorizar execução |
| Todas as oportunidades compartilhadas | Escolha explícita entre pessoal e equipe, protegida por RLS | Cumprir a visibilidade solicitada |
| Navegação móvel escondida no menu | Navegação inferior e ação fixa de registrar reunião | Acesso rápido no celular |

## Compatibilidade

- O RPC de atas e o bucket privado de PDFs permanecem existentes. Cada reunião continua com seu próprio registro.
- Dados anteriores, regras de workspace e papéis da equipe são preservados.
- A migração de oportunidades é aditiva. Registros existentes continuam compartilhados; a escolha pessoal vale para os registros marcados explicitamente.
- A proteção também abrange tarefas, interações e atividades vinculadas a uma oportunidade pessoal.
- Notas de reunião e dados da empresa continuam compartilhados conforme as regras anteriores.
- Sugestões da IA são revisáveis e não criam oportunidades automaticamente no funil.
- Nenhuma API key é alterada; testes usam respostas simuladas, sem chamadas pagas.
- Textos são recuperados pelo navegador. PDFs permanecem em memória durante a sessão da página; após recarregar, a interface pede o reenvio do arquivo.

## Validação

- `pnpm test`: testes de histórico, cadastro rápido, ata, follow-up, rascunho, PDF, falha/sucesso simulados de IA e renovação de sessão.
- `pnpm exec tsc --noEmit`: checagem de tipos.
- `pnpm run build:next`: build de produção equivalente ao configurado na Vercel.
- `pnpm test:e2e`: navegação e ausência de overflow em 360, 390, 768, 1024 e 1440 pixels; CTA visível e recuperação após recarregar.
- Os testes de navegador usam somente a prévia local de desenvolvimento e dados fictícios. Não usam credenciais de produção.
- A migração foi ensaiada em transação com rollback: proprietário, outro membro, compartilhamento, registros vinculados e usuário de fora da equipe.

## Gate de publicação

1. Aprovar testes de componentes, tipos, build e navegador.
2. Aplicar a migração `opportunity_visibility` e confirmar as políticas no Supabase antes de disponibilizar a nova interface em produção.
3. Verificar a prévia com a integração configurada e somente então promover a versão.

O navegador local desta sessão foi bloqueado pelo ambiente. A suíte de navegador fica no GitHub Actions para executar no runner padrão. Enquanto não houver resultado aprovado, a publicação em produção permanece pendente.
