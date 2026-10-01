import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityColumn, ActivityComment, BoardActivity, Company, CompanyDiagnostic, Contact, Interaction, Opportunity, Task, TeamAudit, WorkspaceInvite, WorkspaceMember } from "./crm-types";

async function allRows<T>(client: SupabaseClient, table: string, workspaceId: string, order: string, ascending = false): Promise<T[]> {
  const rows: T[] = [];
  // Sites with a low PostgREST max_rows (including 10) still return every page.
  const pageSize = 10;
  for (let from = 0; ; from += pageSize) {
    const result = await client.from(table).select("*").eq("workspace_id", workspaceId)
      .order(order, { ascending }).range(from, from + pageSize - 1);
    if (result.error) throw result.error;
    const page = (result.data || []) as T[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

/** All reads are scoped by workspace in the query and enforced again by Supabase RLS. */
export async function fetchCrmData(client: SupabaseClient, workspaceId: string) {
  const [companies, contacts, opportunities, tasks, interactions, columns, activities, members, commentRows, diagnostics] = await Promise.all([
    allRows<Company>(client, "companies", workspaceId, "name", true),
    allRows<Contact>(client, "contacts", workspaceId, "created_at"),
    allRows<Opportunity>(client, "opportunities", workspaceId, "created_at"),
    allRows<Task>(client, "tasks", workspaceId, "due_at", true),
    allRows<Interaction>(client, "interactions", workspaceId, "occurred_at"),
    allRows<ActivityColumn>(client, "activity_columns", workspaceId, "position", true),
    allRows<BoardActivity>(client, "board_activities", workspaceId, "position", true),
    allRows<WorkspaceMember>(client, "workspace_members", workspaceId, "joined_at", true),
    allRows<ActivityComment & { activity_id: string }>(client, "activity_comments", workspaceId, "created_at", true),
    allRows<CompanyDiagnostic>(client, "company_diagnostics", workspaceId, "visit_at"),
  ]);
  return { companies, contacts: contacts.filter((item) => !item.archived_at), opportunities, tasks, interactions, columns, activities: activities.map((item) => ({ ...item, comments: commentRows.filter((comment) => comment.activity_id === item.id) })), members, diagnostics };
}

export async function fetchTeamAdminData(client: SupabaseClient, workspaceId: string) {
  const invites: WorkspaceInvite[] = [];
  for (let from = 0; ; from += 10) {
    const result = await client.from("workspace_invites").select("id,workspace_id,invitee_email,role,expires_at,used_at,revoked_at,created_at")
      .eq("workspace_id", workspaceId).order("created_at", { ascending: false }).range(from, from + 9);
    if (result.error) throw result.error;
    invites.push(...(result.data || []) as WorkspaceInvite[]);
    if ((result.data || []).length < 10) break;
  }
  const audit = await allRows<TeamAudit>(client, "team_audit", workspaceId, "created_at");
  return { invites, audit };
}
