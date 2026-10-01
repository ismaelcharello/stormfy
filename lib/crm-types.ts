export const stages = ["Novo lead", "Primeiro contato", "Qualificação", "Reunião agendada", "Proposta enviada", "Negociação", "Ganho", "Perdido"];

export type View = "dashboard" | "contacts" | "companies" | "pipeline" | "tasks" | "activities" | "calendar" | "team";
export type MemberRole = "superadmin" | "admin" | "member" | "reader";
export type WorkspaceMember = { workspace_id: string; user_id: string; role: MemberRole; display_name: string | null; email: string | null; joined_at: string };
export type WorkspaceInvite = { id: string; workspace_id: string; invitee_email: string; role: MemberRole; expires_at: string; used_at: string | null; revoked_at: string | null; created_at: string };
export type TeamAudit = { id: string; workspace_id: string; actor_id: string | null; target_id: string | null; action: string; detail: string | null; created_at: string };
export type ActivityColumn = { id: string; workspace_id: string; title: string; position: number; archived_at: string | null };
export type ActivityChecklistItem = { id: string; title: string; done: boolean };
export type ActivityComment = { id: string; author_id: string; author_name: string; body: string; created_at: string };
export type BoardActivity = { id: string; workspace_id: string; column_id: string; title: string; description: string | null; assigned_to: string | null; priority: "Baixa" | "Média" | "Alta" | "Urgente"; start_at: string | null; due_at: string | null; labels: string[]; checklist: ActivityChecklistItem[]; comments: ActivityComment[]; contact_id: string | null; company_id: string | null; opportunity_id: string | null; created_by: string | null; status: "draft" | "published" | "archived"; position: number; created_at: string; updated_at: string };

export type Workspace = { id: string; name: string; owner_id: string };
export type Contact = {
  id: string; workspace_id: string; company_id: string | null; name: string; title: string | null;
  phone: string | null; whatsapp: string | null; email: string | null; instagram: string | null;
  linkedin: string | null; source: string | null; assigned_to: string | null; notes: string | null;
  created_at: string; archived_at: string | null;
};
export type Company = { id: string; workspace_id: string; name: string; website: string | null; instagram: string | null; segment: string | null; phone: string | null; city: string | null; observations: string | null; archived_at: string | null };
export type Opportunity = {
  id: string; workspace_id: string; title: string; company_id: string | null; contact_id: string | null;
  stage: string; amount: number; assigned_to: string | null; source: string | null;
  expected_close_at: string | null; notes: string | null; created_at: string; is_draft?: boolean;
};
export type Task = {
  id: string; workspace_id: string; title: string; kind: string; contact_id: string | null;
  opportunity_id: string | null; assigned_to: string | null; due_at: string; priority: string;
  status: string; description: string | null; created_at: string; completed_at?: string | null;
  end_at?: string | null; location?: string | null; company_id?: string | null; participants?: string[];
  agenda?: string | null; reminder_at?: string | null; archived_at?: string | null;
  meeting_status?: "Rascunho" | "Agendada" | "Realizada" | "Cancelada" | null;
};
export type Interaction = { id: string; workspace_id: string; contact_id: string | null; opportunity_id: string | null; kind: string; summary: string; result: string | null; occurred_at: string; created_at: string };
export type DiagnosticPain = { text: string; priority: "Baixa" | "Média" | "Alta" };
export type DiagnosticIdea = { title: string; description: string; type: string; potential: "" | "Baixo" | "Médio" | "Alto"; stage: string; amount: string; assigned_to: string; next_step: string; due_at: string; notes: string };
export type CompanyDiagnostic = {
  id: string; workspace_id: string; company_id: string; contact_id: string | null; created_by: string;
  updated_by: string | null; status: "draft" | "completed" | "archived";
  relationship_status: string; potential: string | null; responsible: string | null;
  visit_at: string; visit_kind: string; attendees: string | null; location: string | null; summary: string;
  business_details: Record<string, string>; pains: DiagnosticPain[]; desires: string[]; ideas: DiagnosticIdea[];
  next_action: string | null; next_kind: string | null; next_due_at: string | null;
  next_assigned_to: string | null; next_priority: string | null; next_notes: string | null;
  task_id: string | null; created_at: string; updated_at: string;
};
