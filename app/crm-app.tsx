"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  BadgeCheck,
  Building2,
  CalendarDays,
  CalendarClock,
  Check,
  ChevronRight,
  Copy,
  Pencil,
  LayoutDashboard,
  PanelsTopLeft,
  LoaderCircle,
  LogOut,
  Mail,
  MessageCircle,
  Plus,
  Search,
  Target,
  UserPlus,
  Users,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/crm/field";
import { CalendarView, ContactsView, DashboardView, HistoryTimeline, PipelineView, TasksView } from "@/components/crm/views";
import { ActivityBoard } from "@/components/crm/activity-board";
import { CompanyDiagnosticEditor, diagnosticFormFromRecord, type DiagnosticForm } from "@/components/crm/company-diagnostic";
import { CompanyProfile } from "@/components/crm/company-profile";
import { TeamManagement } from "@/components/crm/team-management";
import { stages, type ActivityColumn, type BoardActivity, type Company, type CompanyDiagnostic, type Contact, type DiagnosticIdea, type Interaction, type MemberRole, type Opportunity, type Task, type TeamAudit, type View, type Workspace, type WorkspaceInvite, type WorkspaceMember } from "@/lib/crm-types";
import { currency, formatDate, initials, newId, safeExternalUrl, taskIsLate } from "@/lib/crm-utils";
import { fetchCrmData, fetchTeamAdminData } from "@/lib/crm-repository";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "contacts", label: "Contatos", icon: Users },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "pipeline", label: "Funil", icon: Target },
  { id: "tasks", label: "Tarefas", icon: CalendarClock },
  { id: "activities", label: "Atividades", icon: PanelsTopLeft },
  { id: "calendar", label: "Calendário", icon: CalendarDays },
  { id: "team", label: "Equipe", icon: UserPlus },
] as const;

const emptyCompany = { name: "", website: "", instagram: "", segment: "", phone: "", city: "", observations: "" };
const emptyContact = { name: "", company: "", title: "", phone: "", whatsapp: "", email: "", instagram: "", linkedin: "", source: "", assigned_to: "", notes: "" };
const emptyOpportunity = { title: "", company_id: "", contact_id: "", stage: "Novo lead", amount: "", assigned_to: "", source: "", expected_close_at: "", notes: "", is_draft: false };
const emptyTask = { title: "", kind: "Ligação", contact_id: "", company_id: "", opportunity_id: "", due_at: "", end_at: "", location: "", participants: "", agenda: "", reminder_at: "", meeting_status: "Agendada", priority: "Média", assigned_to: "", description: "" };
const demoStorageKey = "vexo_crm_local_data_v1";

const demoWorkspace: Workspace = { id: "demo-workspace", name: "Stormfy Comercial", owner_id: "demo-owner" };
const defaultColumnNames = ["Caixa de entrada", "A fazer", "Em andamento", "Em revisão", "Concluído"];
const demoColumns: ActivityColumn[] = defaultColumnNames.map((title, position) => ({ id: `demo-column-${position}`, workspace_id: demoWorkspace.id, title, position, archived_at: null }));
const demoCompanies: Company[] = [
  { id: "demo-metallum", workspace_id: demoWorkspace.id, name: "Metallum", website: null, instagram: "https://www.instagram.com/metallumcwb/", segment: null, phone: null, city: null, observations: null, archived_at: null },
  { id: "demo-fala-corretor", workspace_id: demoWorkspace.id, name: "Fala Corretor", website: null, instagram: "https://www.instagram.com/falacorretor.oficial/", segment: null, phone: null, city: null, observations: null, archived_at: null },
];
const demoContacts: Contact[] = [
  { id: "demo-rafael", workspace_id: demoWorkspace.id, company_id: "demo-metallum", name: "Rafael Gregório", title: null, phone: null, whatsapp: null, email: null, instagram: "https://www.instagram.com/rafaelmpgregorio/", linkedin: null, source: "Lista inicial", assigned_to: null, notes: "Contato inicial informado por Ismael.", created_at: new Date().toISOString(), archived_at: null },
  { id: "demo-lucas", workspace_id: demoWorkspace.id, company_id: "demo-fala-corretor", name: "Lucas Lima", title: null, phone: null, whatsapp: null, email: null, instagram: "https://www.instagram.com/lucaslima_falacorretor/", linkedin: null, source: "Lista inicial", assigned_to: null, notes: "Contato inicial informado por Ismael.", created_at: new Date().toISOString(), archived_at: null },
  { id: "demo-thiago", workspace_id: demoWorkspace.id, company_id: null, name: "Thiago Romani", title: null, phone: null, whatsapp: null, email: null, instagram: "https://www.instagram.com/thiago.romani/", linkedin: null, source: "Lista inicial", assigned_to: null, notes: "Empresa ainda precisa ser completada (informada apenas como E).", created_at: new Date().toISOString(), archived_at: null },
];
const demoOpportunities: Opportunity[] = [];
const demoTasks: Task[] = [];
const demoInteractions: Interaction[] = [];

type CrmAppProps = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  aiEnabled?: boolean;
};

export default function CrmApp({ supabaseUrl, supabasePublishableKey, aiEnabled }: CrmAppProps) {
  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabasePublishableKey) return null;
    return createBrowserClient(supabaseUrl, supabasePublishableKey);
  }, [supabasePublishableKey, supabaseUrl]);

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(supabase));
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceName, setWorkspaceName] = useState("CRM Comercial");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [columns, setColumns] = useState<ActivityColumn[]>([]);
  const [activities, setActivities] = useState<BoardActivity[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invites, setInvites] = useState<WorkspaceInvite[]>([]);
  const [teamAudit, setTeamAudit] = useState<TeamAudit[]>([]);
  const [role, setRole] = useState<MemberRole>("reader");
  const [inviteRole, setInviteRole] = useState<MemberRole>("member");
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [authMode, setAuthMode] = useState<"login" | "signup" | "reset" | "updatePassword">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [hasPendingInvite, setHasPendingInvite] = useState(false);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"company" | "contact" | "opportunity" | "task" | "interaction" | "invite" | "contactDetail" | "opportunityDetail" | null>(null);
  const [diagnostics, setDiagnostics] = useState<CompanyDiagnostic[]>([]);
  const [diagnosticEditor, setDiagnosticEditor] = useState<{ companyId?: string; contactId?: string; item?: CompanyDiagnostic; meeting?: Task } | null>(null);
  const [detailCompanyId, setDetailCompanyId] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingOpportunityId, setEditingOpportunityId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [detailOpportunityId, setDetailOpportunityId] = useState<string | null>(null);
  const [bootstrapAvailable, setBootstrapAvailable] = useState<boolean | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [contactCompanyFilter, setContactCompanyFilter] = useState("");
  const [contactSourceFilter, setContactSourceFilter] = useState("");
  const [opportunityStageFilter, setOpportunityStageFilter] = useState("");
  const [opportunityAssignedFilter, setOpportunityAssignedFilter] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("");
  const [importing, setImporting] = useState(false);
  const [contactForm, setContactForm] = useState(emptyContact);
  const [opportunityForm, setOpportunityForm] = useState(emptyOpportunity);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [interactionForm, setInteractionForm] = useState({ contact_id: "", opportunity_id: "", kind: "WhatsApp", summary: "", result: "" });
  const [resultTaskId, setResultTaskId] = useState<string | null>(null);
  const [scheduleNext, setScheduleNext] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [draggedOpportunity, setDraggedOpportunity] = useState<string | null>(null);
  const [activityCreateRequest, setActivityCreateRequest] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const [localBackupCount, setLocalBackupCount] = useState(0);
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState(true);

  const user = session?.user ?? (demoMode ? ({ id: "demo-owner", email: "Demonstração local", app_metadata: {}, user_metadata: { full_name: "Visitante" }, aud: "authenticated", created_at: new Date().toISOString() } as Session["user"]) : null);
  const owner = role === "superadmin" || role === "admin" || workspace?.owner_id === user?.id;
  const canEdit = demoMode || role !== "reader";
  const closeModal = () => {
    setModal(null);
    setEditingCompanyId(null); setEditingContactId(null); setEditingOpportunityId(null); setEditingTaskId(null);
    setCompanyForm(emptyCompany); setContactForm(emptyContact); setOpportunityForm(emptyOpportunity); setTaskForm(emptyTask);
    setInteractionForm({ contact_id: "", opportunity_id: "", kind: "WhatsApp", summary: "", result: "" });
    setResultTaskId(null); setScheduleNext(false);
  };

  const loadWorkspaceData = useCallback(async (workspaceId: string) => {
    if (!supabase) return;
    try {
      const data = await fetchCrmData(supabase, workspaceId);
      setDataError(null);
      setCompanies(data.companies);
      setContacts(data.contacts);
      setOpportunities(data.opportunities);
      setTasks(data.tasks);
      setInteractions(data.interactions);
      setColumns(data.columns);
      setActivities(data.activities);
      setDiagnostics(data.diagnostics);
      setMembers(data.members);
    } catch (error) {
      setDataError("Não foi possível carregar os clientes. Verifique a conexão e tente novamente.");
      toast.error("Não consegui carregar os dados do CRM", { description: error instanceof Error ? error.message : "Tente novamente." });
    }
  }, [supabase]);

  const loadTeamData = useCallback(async (workspaceId: string) => {
    if (!supabase) return;
    try { const data = await fetchTeamAdminData(supabase, workspaceId); setInvites(data.invites); setTeamAudit(data.audit); }
    catch (error) { toast.error("Não foi possível carregar a equipe", { description: error instanceof Error ? error.message : "Tente novamente." }); }
  }, [supabase]);

  const loadMembership = useCallback(async () => {
    if (!supabase || !session?.user) {
      setWorkspace(null);
      setWorkspaceLoading(false);
      return;
    }
    setWorkspaceLoading(true);
    setAccessError(null);
    let { data: member, error: memberError } = await supabase.from("workspace_members").select("workspace_id,role").eq("user_id", session.user.id).maybeSingle();

    const pendingInvite = window.localStorage.getItem("crm_pending_invite");
    if (!member && !memberError && pendingInvite) {
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(pendingInvite));
      const codeHash = Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const { error: inviteError } = await supabase.rpc("join_workspace_by_invite", { p_token_hash: codeHash });
      if (!inviteError) {
        window.localStorage.removeItem("crm_pending_invite");
        toast.success("Você entrou no CRM compartilhado");
        const result = await supabase.from("workspace_members").select("workspace_id,role").eq("user_id", session.user.id).maybeSingle();
        member = result.data;
        memberError = result.error;
      } else {
        const connectionError = inviteError.message.toLowerCase().includes("fetch");
        toast.error(connectionError ? "Não consegui verificar o convite" : "Não foi possível aceitar o convite",
          { description: connectionError ? "Verifique a conexão e tente novamente." : inviteError.message });
        if (!connectionError) window.localStorage.removeItem("crm_pending_invite");
      }
    }

    if (memberError) {
      setAccessError("Não foi possível verificar o acesso à equipe. Verifique a conexão.");
      toast.error("Não foi possível verificar o acesso à equipe", { description: memberError.message });
      setWorkspaceLoading(false);
      return;
    }
    if (!member) {
      setWorkspace(null);
      const { data: available, error: bootstrapError } = await supabase.rpc("workspace_bootstrap_available");
      if (bootstrapError) {
        setAccessError("Não foi possível verificar a ativação do CRM. Tente novamente.");
        toast.error("Não foi possível verificar a ativação do CRM", { description: bootstrapError.message });
      }
      setBootstrapAvailable(available === true);
      setWorkspaceLoading(false);
      return;
    }
    const { data: workspaceData, error: workspaceError } = await supabase.from("workspaces").select("id,name,owner_id").eq("id", member.workspace_id).single();
    if (workspaceError || !workspaceData) {
      setAccessError("Não foi possível abrir o espaço da equipe. Tente novamente.");
      toast.error("Não consegui abrir o workspace", { description: workspaceError?.message || "Verifique as permissões no Supabase." });
      setWorkspaceLoading(false);
      return;
    }
    setWorkspace(workspaceData as Workspace);
    setRole(member.role as MemberRole);
    if (["superadmin", "admin"].includes(member.role)) void loadTeamData(member.workspace_id);
    setBootstrapAvailable(false);
    setWorkspaceName((workspaceData as Workspace).name);
    await loadWorkspaceData((workspaceData as Workspace).id);
    setWorkspaceLoading(false);
  }, [supabase, session, loadWorkspaceData, loadTeamData]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.rpc("workspace_bootstrap_available").then(({ data }) => { if (active) setBootstrapAvailable(data === true); });
    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setAuthLoading(false);
      }
    }).catch(() => {
      if (active) { setAuthLoading(false); toast.error("Não consegui verificar sua sessão"); }
    });
    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      if (event === "PASSWORD_RECOVERY") setAuthMode("updatePassword");
    });
    const invite = new URLSearchParams(window.location.hash.slice(1)).get("convite");
    if (invite) {
      window.localStorage.setItem("crm_pending_invite", invite);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    queueMicrotask(() => { if (active) setHasPendingInvite(Boolean(window.localStorage.getItem("crm_pending_invite"))); });
    return () => {
      active = false;
      authSubscription.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    // Keep the first client render identical to the server render. A browser
    // with old demo contacts can then offer an explicit import after hydration.
    try {
      const data = JSON.parse(window.localStorage.getItem(demoStorageKey) || "{}");
      const count = Array.isArray(data.contacts) ? data.contacts.filter((item: Contact) => !item.archived_at).length : 0;
      queueMicrotask(() => setLocalBackupCount(count));
    } catch { queueMicrotask(() => setLocalBackupCount(0)); }
  }, []);

  useEffect(() => {
    // A consulta assíncrona é a sincronização da sessão com o backend protegido por RLS.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (session?.user) void loadMembership();
    else {
      setWorkspace(null);
      setContacts([]);
      setCompanies([]);
      setOpportunities([]);
      setTasks([]);
      setInteractions([]);
      setColumns([]);
      setActivities([]);
      setDiagnostics([]);
      setMembers([]);
      setInvites([]);
      setTeamAudit([]);
    }
  }, [session?.user, loadMembership]);

  useEffect(() => {
    if (!demoMode) return;
    window.localStorage.setItem(demoStorageKey, JSON.stringify({ companies, contacts, opportunities, tasks, interactions, columns, activities, diagnostics }));
  }, [demoMode, companies, contacts, opportunities, tasks, interactions, columns, activities, diagnostics]);

  const refreshData = async () => {
    if (workspace) await loadWorkspaceData(workspace.id);
  };

  const saveDiagnostic = async (form: DiagnosticForm, id?: string, pdf?: File | null): Promise<string | null> => {
    if (!workspace || !user || !canEdit) return null;
    const payload = {
      ...form,
      visit_at: form.visit_at ? new Date(form.visit_at.length === 10 ? `${form.visit_at}T12:00:00` : form.visit_at).toISOString() : new Date().toISOString(),
      next_due_at: form.next_due_at ? new Date(form.next_due_at).toISOString() : null,
      pains: form.pains.filter((item) => item.text.trim()),
      desires: form.desires.filter((item) => item.trim()),
      ideas: form.ideas.filter((item) => item.title.trim()),
    };
    if (demoMode && pdf) { toast.error("O anexo PDF requer acesso ao CRM compartilhado."); return null; }
    if (demoMode) {
      const now = new Date().toISOString();
      const existing = diagnostics.find((item) => item.id === id);
      const diagnosticId = existing?.id || newId();
      const taskId = form.schedule_task && form.status === "completed" && form.next_due_at ? existing?.task_id || newId() : existing?.task_id || null;
      const record: CompanyDiagnostic = {
        id: diagnosticId, workspace_id: workspace.id, company_id: form.company_id,
        contact_id: form.contact_id || null, created_by: existing?.created_by || user.id, updated_by: user.id,
        status: form.status, relationship_status: form.relationship_status, potential: form.potential || null,
        responsible: form.responsible || null, visit_at: payload.visit_at, visit_kind: form.visit_kind,
        attendees: form.attendees || null, location: form.location || null, summary: form.summary,
        business_details: form.business_details, pains: payload.pains, desires: payload.desires, ideas: payload.ideas,
        next_action: form.next_action || null, next_kind: form.next_kind || null, next_due_at: payload.next_due_at,
        next_assigned_to: form.next_assigned_to || null, next_priority: form.next_priority || null,
        next_notes: form.next_notes || null, task_id: taskId, created_at: existing?.created_at || now, updated_at: now,
      };
      setDiagnostics((current) => existing ? current.map((item) => item.id === id ? record : item) : [record, ...current]);
      if (taskId && payload.next_due_at) {
        const related: Task = { id: taskId, workspace_id: workspace.id, title: form.next_action.slice(0,200),
          kind: ["Ligação","WhatsApp","E-mail","Reunião"].includes(form.next_kind) ? form.next_kind : "Tarefa",
          contact_id: form.contact_id || null, opportunity_id: null, company_id: form.company_id,
          assigned_to: form.next_assigned_to || null, due_at: payload.next_due_at, priority: form.next_priority,
          status: "Pendente", description: form.next_notes || null, created_at: now };
        setTasks((current) => current.some((item) => item.id === taskId) ? current.map((item) => item.id === taskId ? { ...item, ...related } : item) : [...current, related]);
      }
      if (form.status === "completed" && !form.schedule_task) {
        toast.success("Diagnóstico salvo. Deseja agendar o próximo contato?", { action: { label: "Agendar agora", onClick: () => {
          setTaskForm({ ...emptyTask, title: form.next_action || `Retomar contato — ${companies.find((item) => item.id === form.company_id)?.name || "empresa"}`, company_id: form.company_id, contact_id: form.contact_id, assigned_to: form.next_assigned_to });
          setModal("task");
        } } });
      } else toast.success(form.status === "draft" ? "Rascunho salvo neste navegador" : "Diagnóstico salvo neste navegador");
      return diagnosticId;
    }
    if (!supabase) return null;
    let uploadedPath = "";
    if (pdf) {
      if (pdf.type !== "application/pdf" || pdf.size > 8 * 1024 * 1024 || pdf.size < 100) { toast.error("Escolha um PDF válido de até 8 MB."); return null; }
      uploadedPath = `${workspace.id}/${form.company_id}/${crypto.randomUUID()}.pdf`;
      const uploaded = await supabase.storage.from("meeting-minutes").upload(uploadedPath, pdf, { contentType: "application/pdf", upsert: false });
      if (uploaded.error) { toast.error("Não consegui anexar a ata", { description: uploaded.error.message }); return null; }
      payload.business_details = { ...form.business_details, attachment_path: uploadedPath, attachment_name: pdf.name.slice(0,160) };
    }
    const { data, error } = await supabase.rpc("save_company_diagnostic", { p_company_id: form.company_id, p_data: payload, p_id: id || null });
    if (error) { if (uploadedPath) await supabase.storage.from("meeting-minutes").remove([uploadedPath]); toast.error("Não consegui salvar o diagnóstico", { description: error.message }); return null; }
    await refreshData();
    if (form.status === "completed" && !form.schedule_task) {
      toast.success("Diagnóstico salvo. Deseja agendar o próximo contato?", { action: { label: "Agendar agora", onClick: () => {
        setTaskForm({ ...emptyTask, title: form.next_action || `Retomar contato — ${companies.find((item) => item.id === form.company_id)?.name || "empresa"}`, company_id: form.company_id, contact_id: form.contact_id, assigned_to: form.next_assigned_to });
        setModal("task");
      } } });
    } else toast.success(form.status === "draft" ? "Rascunho salvo" : "Diagnóstico e próximo passo salvos");
    return String(data);
  };

  const openDiagnostic = (companyId?: string, contactId?: string, item?: CompanyDiagnostic, meeting?: Task) => {
    if (!canEdit) { toast.error("Seu acesso permite apenas consultar diagnósticos."); return; }
    setModal(null);
    setDetailCompanyId(null);
    setDiagnosticEditor({ companyId, contactId, item, meeting });
  };

  const openMeetingAttachment = async (path: string) => {
    if (!supabase || !workspace || !path.startsWith(`${workspace.id}/`)) return;
    const { data, error } = await supabase.storage.from("meeting-minutes").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toast.error("Não consegui abrir a ata."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const quickCreateCompany = async (name: string, contactName: string, phone: string): Promise<{ companyId: string; contactId: string } | null> => {
    if (!workspace || !canEdit || !name.trim()) return null;
    if (companies.some((item) => !item.archived_at && item.name.trim().toLocaleLowerCase("pt-BR") === name.trim().toLocaleLowerCase("pt-BR"))) {
      toast.error("Esta empresa já está cadastrada. Selecione-a na lista."); return null;
    }
    if (demoMode) {
      const companyId = newId(); const contactId = contactName.trim() ? newId() : "";
      setCompanies((current) => [...current, { id: companyId, workspace_id: workspace.id, name: name.trim(), website: null, instagram: null, segment: null, phone: null, city: null, observations: null, archived_at: null }]);
      if (contactId) setContacts((current) => [...current, { id: contactId, workspace_id: workspace.id, company_id: companyId, name: contactName.trim(), title: null, phone: phone.trim() || null, whatsapp: null, email: null, instagram: null, linkedin: null, source: null, assigned_to: null, notes: null, created_at: new Date().toISOString(), archived_at: null }]);
      return { companyId, contactId };
    }
    if (!supabase) return null;
    const company = await supabase.from("companies").insert({ workspace_id: workspace.id, name: name.trim() }).select("id").single();
    if (company.error || !company.data) { toast.error("Não consegui cadastrar a empresa", { description: company.error?.message }); return null; }
    let contactId = "";
    if (contactName.trim()) {
      const contact = await supabase.from("contacts").insert({ workspace_id: workspace.id, company_id: company.data.id, name: contactName.trim(), phone: phone.trim() || null }).select("id").single();
      if (contact.error) toast.error("Empresa criada; não consegui salvar a pessoa", { description: contact.error.message });
      else contactId = contact.data.id;
    }
    await refreshData();
    toast.success("Empresa pronta para receber o diagnóstico");
    return { companyId: company.data.id, contactId };
  };

  const createOpportunityFromDiagnosis = (diagnostic: CompanyDiagnostic, idea: DiagnosticIdea) => {
    setOpportunityForm({ ...emptyOpportunity, title: idea.title, company_id: diagnostic.company_id,
      contact_id: diagnostic.contact_id || "", stage: idea.stage || "Novo lead", amount: idea.amount || "",
      assigned_to: idea.assigned_to || diagnostic.responsible || "", source: "Diagnóstico de visita",
      expected_close_at: idea.due_at || "", notes: [idea.description, idea.next_step && `Próximo passo: ${idea.next_step}`, idea.notes].filter(Boolean).join("\n"), is_draft: false });
    setDetailCompanyId(null); setModal("opportunity");
  };

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setAuthMessage("");
    if (authMode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail, { redirectTo: window.location.origin });
      if (error) toast.error("Não consegui enviar o link", { description: error.message });
      else setAuthMessage("Se esse e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.");
      setBusy(false);
      return;
    }
    if (authMode === "updatePassword") {
      const { error } = await supabase.auth.updateUser({ password: authPassword });
      if (error) toast.error("Não foi possível alterar a senha", { description: error.message });
      else {
        setAuthPassword("");
        setAuthMode("login");
        toast.success("Senha alterada com sucesso");
      }
      setBusy(false);
      return;
    }
    if (authMode === "signup") {
      const invite = new URLSearchParams(window.location.hash.slice(1)).get("convite");
      if (invite) window.localStorage.setItem("crm_pending_invite", invite);
      const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword, options: { data: { full_name: authName.trim() }, emailRedirectTo: window.location.origin } });
      if (error) toast.error("Não consegui criar o acesso", { description: error.message });
      else if (data.session) toast.success("Acesso criado");
      else setAuthMessage("Confira seu e-mail para confirmar o cadastro. Depois, volte aqui para entrar.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) toast.error("E-mail ou senha não conferem", { description: error.message });
    setBusy(false);
  };

  const signOut = async () => {
    if (demoMode) {
      setDemoMode(false);
      setWorkspace(null);
      return;
    }
    if (!supabase) return;
    await supabase.auth.signOut();
    toast.success("Você saiu do CRM");
  };

  const createWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase || !user || !workspaceName.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("create_workspace_for_current_user", { p_name: workspaceName.trim() });
    if (error) toast.error("Não consegui criar o espaço da equipe", { description: error.message });
    else {
      toast.success("CRM da equipe criado");
      await loadMembership();
    }
    setBusy(false);
  };

  const createInvite = async () => {
    if (!supabase || !workspace || !user || !owner || !inviteEmail.trim()) return;
    setBusy(true);
    const bytes = window.crypto.getRandomValues(new Uint8Array(32));
    const rawToken = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
    const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("workspace_invites").insert({ workspace_id: workspace.id, token_hash: tokenHash, invitee_email: inviteEmail.trim().toLowerCase(), role: inviteRole, created_by: user.id, expires_at: expiresAt });
    if (error) toast.error("Não consegui gerar o convite", { description: error.message });
    else {
      setInviteUrl(`${window.location.origin}/app#convite=${rawToken}`);
      setModal("invite");
      await loadTeamData(workspace.id);
    }
    setBusy(false);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Link copiado. Envie para o Rudy.");
    } catch { toast.error("Não consegui copiar. Selecione o link e copie manualmente."); }
  };

  const changeMemberRole = async (memberId: string, nextRole: MemberRole) => {
    if (!supabase || !workspace || !owner || !user || !window.confirm(`Alterar o papel deste membro para ${nextRole}?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("change_team_role", { p_workspace: workspace.id, p_member: memberId, p_role: nextRole });
    if (error) toast.error("Não foi possível alterar o acesso", { description: error.message });
    else { toast.success("Acesso atualizado"); await refreshData(); await loadTeamData(workspace.id); }
    setBusy(false);
  };
  const removeMember = async (memberId: string) => {
    if (!supabase || !workspace || !owner || !window.confirm("Remover este membro da equipe? Ele perderá acesso aos dados compartilhados.")) return;
    setBusy(true);
    const { error } = await supabase.rpc("remove_team_member", { p_workspace: workspace.id, p_member: memberId });
    if (error) toast.error("Não foi possível remover o membro", { description: error.message });
    else { toast.success("Membro removido"); await refreshData(); await loadTeamData(workspace.id); }
    setBusy(false);
  };
  const revokeInvite = async (inviteId: string) => {
    if (!supabase || !workspace || !owner) return;
    setBusy(true);
    const { error } = await supabase.rpc("revoke_team_invite", { p_invite: inviteId });
    if (error) toast.error("Não foi possível revogar o convite", { description: error.message });
    else { toast.success("Convite revogado"); await loadTeamData(workspace.id); }
    setBusy(false);
  };

  const saveCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace || !companyForm.name.trim()) return;
    if (demoMode) {
      const duplicate = companies.some((item) => item.id !== editingCompanyId && !item.archived_at && item.name.toLocaleLowerCase("pt-BR") === companyForm.name.trim().toLocaleLowerCase("pt-BR"));
      if (duplicate) return toast.error("Já existe uma empresa ativa com esse nome.");
      const values: Company = { id: editingCompanyId || newId(), workspace_id: workspace.id, name: companyForm.name.trim(), website: companyForm.website || null, instagram: companyForm.instagram || null, segment: companyForm.segment || null, phone: companyForm.phone || null, city: companyForm.city || null, observations: companyForm.observations || null, archived_at: null };
      setCompanies((current) => editingCompanyId ? current.map((item) => item.id === editingCompanyId ? values : item) : [values, ...current]);
      toast.success("Empresa salva neste navegador");
      closeModal();
      return;
    }
    if (!supabase) return;
    setBusy(true);
    const values = { workspace_id: workspace.id, name: companyForm.name.trim(), website: companyForm.website || null,
      instagram: companyForm.instagram || null, segment: companyForm.segment || null, phone: companyForm.phone || null,
      city: companyForm.city || null, observations: companyForm.observations || null };
    const { error } = editingCompanyId
      ? await supabase.from("companies").update(values).eq("id", editingCompanyId).eq("workspace_id", workspace.id).select("id").single()
      : await supabase.from("companies").insert(values);
    if (error) toast.error("Não consegui salvar a empresa", { description: error.code === "23505" ? "Já existe uma empresa ativa com esse nome." : error.message });
    else {
      toast.success("Empresa salva");
      setModal(null);
      setEditingCompanyId(null);
      setCompanyForm(emptyCompany);
      await refreshData();
    }
    setBusy(false);
  };

  const editCompany = (company: Company) => {
    setEditingCompanyId(company.id);
    setCompanyForm({ name: company.name, website: company.website || "", instagram: company.instagram || "",
      segment: company.segment || "", phone: company.phone || "", city: company.city || "", observations: company.observations || "" });
    setModal("company");
  };

  const editContact = (contact: Contact) => {
    setEditingContactId(contact.id);
    setContactForm({ name: contact.name, company: companies.find((item) => item.id === contact.company_id)?.name || "",
      title: contact.title || "", phone: contact.phone || "", whatsapp: contact.whatsapp || "", email: contact.email || "",
      instagram: contact.instagram || "", linkedin: contact.linkedin || "", source: contact.source || "",
      assigned_to: contact.assigned_to || "", notes: contact.notes || "" });
    setModal("contact");
  };

  const editOpportunity = (opportunity: Opportunity) => {
    setEditingOpportunityId(opportunity.id);
    setOpportunityForm({ title: opportunity.title, company_id: opportunity.company_id || "", contact_id: opportunity.contact_id || "",
      stage: opportunity.stage, amount: String(opportunity.amount), assigned_to: opportunity.assigned_to || "",
      source: opportunity.source || "", expected_close_at: opportunity.expected_close_at || "", notes: opportunity.notes || "", is_draft: Boolean(opportunity.is_draft) });
    setModal("opportunity");
  };

  const editTask = (task: Task) => {
    setEditingTaskId(task.id);
    const date = new Date(task.due_at);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const endDate = task.end_at ? new Date(task.end_at) : null;
    setTaskForm({ title: task.title, kind: task.kind, contact_id: task.contact_id || "", company_id: task.company_id || "",
      opportunity_id: task.opportunity_id || "", due_at: local,
      end_at: endDate ? new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
      location: task.location || "", participants: (task.participants || []).join(", "), agenda: task.agenda || "",
      reminder_at: task.reminder_at ? new Date(new Date(task.reminder_at).getTime() - new Date(task.reminder_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "", meeting_status: task.meeting_status || "Agendada", priority: task.priority, assigned_to: task.assigned_to || "",
      description: task.description || "" });
    setModal("task");
  };

  const archiveRecord = async (table: "contacts" | "companies", id: string, name: string) => {
    if (!workspace || !window.confirm(`Arquivar ${name}? O histórico será preservado.`)) return;
    if (demoMode) {
      const archivedAt = new Date().toISOString();
      if (table === "contacts") setContacts((current) => current.map((item) => item.id === id ? { ...item, archived_at: archivedAt } : item));
      else setCompanies((current) => current.map((item) => item.id === id ? { ...item, archived_at: archivedAt } : item));
      toast.success("Registro arquivado");
      setModal(null);
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.from(table).update({ archived_at: new Date().toISOString() }).eq("id", id).eq("workspace_id", workspace.id).select("id").single();
    if (error) toast.error("Não consegui arquivar", { description: error.message });
    else { toast.success("Registro arquivado"); setModal(null); await refreshData(); }
  };

  const restoreCompany = async (company: Company) => {
    if (!workspace) return;
    if (demoMode) {
      setCompanies((current) => current.map((item) => item.id === company.id ? { ...item, archived_at: null } : item));
      toast.success("Empresa restaurada");
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.from("companies").update({ archived_at: null }).eq("id", company.id).eq("workspace_id", workspace.id).select("id").single();
    if (error) toast.error("Não consegui restaurar", { description: error.code === "23505" ? "Já existe uma empresa ativa com esse nome." : error.message });
    else { toast.success("Empresa restaurada"); await refreshData(); }
  };

  const cancelTask = async (task: Task) => {
    if (!workspace || !window.confirm(`Cancelar a tarefa “${task.title}”?`)) return;
    if (demoMode) {
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: "Cancelada", meeting_status: item.kind === "Reunião" ? "Cancelada" : item.meeting_status } : item));
      toast.success("Tarefa cancelada");
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.from("tasks").update({ status: "Cancelada", ...(task.kind === "Reunião" ? { meeting_status: "Cancelada" } : {}) }).eq("id", task.id).eq("workspace_id", workspace.id).select("id").single();
    if (error) toast.error("Não consegui cancelar a tarefa", { description: error.message });
    else { toast.success("Tarefa cancelada"); await refreshData(); }
  };

  const archiveMeeting = async (meeting: Task, restore = false) => {
    if (!workspace || meeting.kind !== "Reunião" || !canEdit) return;
    if (!restore && !window.confirm(`Arquivar a reunião “${meeting.title}”? Ela sairá da agenda, mas poderá ser restaurada.`)) return;
    const archivedAt = restore ? null : new Date().toISOString();
    if (demoMode) {
      setTasks((current) => current.map((item) => item.id === meeting.id ? { ...item, archived_at: archivedAt } : item));
      toast.success(restore ? "Reunião restaurada" : "Reunião arquivada");
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.from("tasks").update({ archived_at: archivedAt }).eq("id", meeting.id).eq("workspace_id", workspace.id).select("id").single();
    if (error) toast.error("Não foi possível atualizar a reunião", { description: error.message });
    else { toast.success(restore ? "Reunião restaurada" : "Reunião arquivada"); await refreshData(); }
  };

  const deleteMeeting = async (meeting: Task) => {
    if (!workspace || (role !== "superadmin" && role !== "admin") || !window.confirm(`Excluir definitivamente a reunião “${meeting.title}”? Esta ação não pode ser desfeita.`)) return;
    if (demoMode) { setTasks((current) => current.filter((item) => item.id !== meeting.id)); toast.success("Reunião excluída"); return; }
    if (!supabase) return;
    const { error } = await supabase.from("tasks").delete().eq("id", meeting.id).eq("workspace_id", workspace.id).select("id").single();
    if (error) toast.error("Não foi possível excluir a reunião", { description: error.message });
    else { toast.success("Reunião excluída"); await refreshData(); }
  };

  const importInitialContacts = async () => {
    if (!workspace || importing) return;
    if (demoMode) {
      setCompanies((current) => [...current, ...demoCompanies.filter((company) => !current.some((item) => item.name.toLocaleLowerCase("pt-BR") === company.name.toLocaleLowerCase("pt-BR")))]);
      setContacts((current) => [...current, ...demoContacts.filter((contact) => !current.some((item) => item.instagram === contact.instagram)).map((contact) => ({ ...contact, company_id: companies.find((item) => item.name === demoCompanies.find((company) => company.id === contact.company_id)?.name)?.id || contact.company_id }))]);
      toast.success("Contatos iniciais adicionados neste navegador");
      return;
    }
    if (!supabase) return;
    setImporting(true);
    let imported = 0;
    const sample = [
      { name: "Rafael Gregório", instagram: "https://www.instagram.com/rafaelmpgregorio/", company: "Metallum", companyInstagram: "https://www.instagram.com/metallumcwb/" },
      { name: "Lucas Lima", instagram: "https://www.instagram.com/lucaslima_falacorretor/", company: "Fala Corretor", companyInstagram: "https://www.instagram.com/falacorretor.oficial/" },
      { name: "Thiago Romani", instagram: "https://www.instagram.com/thiago.romani/", company: "", companyInstagram: "" },
    ];
    for (const item of sample) {
      const exists = await supabase.from("contacts").select("id").eq("workspace_id", workspace.id).eq("instagram", item.instagram).maybeSingle();
      if (exists.error) { toast.error("Não consegui verificar os contatos", { description: exists.error.message }); break; }
      if (exists.data) continue;
      let companyId: string | null = null;
      if (item.company) {
        const existing = await supabase.from("companies").select("id").eq("workspace_id", workspace.id).eq("name", item.company).is("archived_at", null).maybeSingle();
        if (existing.error) { toast.error("Não consegui verificar a empresa", { description: existing.error.message }); break; }
        if (existing.data) companyId = existing.data.id;
        else {
          const created = await supabase.from("companies").insert({ workspace_id: workspace.id, name: item.company, instagram: item.companyInstagram }).select("id").single();
          if (created.error) { toast.error("Não consegui importar a empresa", { description: created.error.message }); break; }
          companyId = created.data.id;
        }
      }
      const created = await supabase.from("contacts").insert({ workspace_id: workspace.id, name: item.name, company_id: companyId, instagram: item.instagram, source: "Lista inicial" });
      if (created.error) { toast.error("Não consegui importar o contato", { description: created.error.message }); break; }
      imported++;
    }
    if (imported) toast.success(`${imported} contato${imported > 1 ? "s" : ""} importado${imported > 1 ? "s" : ""}`);
    await refreshData();
    setImporting(false);
  };

  const importLocalContacts = async (confirmed = false) => {
    if (!supabase || !workspace || !canEdit || importing) return;
    const stored = window.localStorage.getItem(demoStorageKey);
    if (!stored) return;
    let backup: { companies?: Company[]; contacts?: Contact[] };
    try { backup = JSON.parse(stored); } catch { return toast.error("Os dados locais não puderam ser lidos"); }
    const entries = (backup.contacts || []).filter((item) => !item.archived_at);
    if (!entries.length || (!confirmed && !window.confirm(`Importar até ${entries.length} contatos salvos neste navegador para a base compartilhada? Os dados locais serão preservados.`))) return;
    setImporting(true);
    let imported = 0;
    const existingCompanies = [...companies];
    const knownContacts = [...contacts];
    let failed = false;
    for (const contact of entries) {
      const duplicate = knownContacts.some((item) => (contact.instagram && item.instagram?.toLowerCase() === contact.instagram.toLowerCase()) || (contact.email && item.email?.toLowerCase() === contact.email.toLowerCase()) || (item.name.toLowerCase() === contact.name.toLowerCase() && !contact.instagram && !contact.email));
      if (duplicate) continue;
      let companyId: string | null = null;
      const sourceCompany = backup.companies?.find((item) => item.id === contact.company_id);
      if (sourceCompany) {
        let company = existingCompanies.find((item) => !item.archived_at && item.name.toLocaleLowerCase("pt-BR") === sourceCompany.name.toLocaleLowerCase("pt-BR"));
        if (!company) {
          const result = await supabase.from("companies").insert({ workspace_id: workspace.id, name: sourceCompany.name, website: sourceCompany.website, instagram: sourceCompany.instagram, segment: sourceCompany.segment, phone: sourceCompany.phone, city: sourceCompany.city, observations: sourceCompany.observations }).select("*").single();
          if (result.error) { failed = true; break; }
          company = result.data as Company;
          existingCompanies.push(company);
        }
        companyId = company.id;
      }
      const result = await supabase.from("contacts").insert({ workspace_id: workspace.id, company_id: companyId, name: contact.name, title: contact.title, phone: contact.phone, whatsapp: contact.whatsapp, email: contact.email, instagram: contact.instagram, linkedin: contact.linkedin, source: contact.source, assigned_to: contact.assigned_to, notes: contact.notes }).select("*").single();
      if (result.error) { failed = true; break; }
      knownContacts.push(result.data as Contact);
      imported++;
    }
    await refreshData();
    setImporting(false);
    if (failed) toast.error(`Importação interrompida após ${imported} contato(s). Os dados locais foram preservados; tente novamente.`);
    else {
      setLocalBackupCount(0);
      setRecoveryDialogOpen(false);
      toast.success(`${imported} contato(s) importado(s). Registros já existentes foram ignorados.`);
    }
  };

  const addContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace || !contactForm.name.trim()) return;
    if (demoMode) {
      let companyId: string | null = null;
      const companyName = contactForm.company.trim();
      if (companyName) {
        const existing = companies.find((item) => !item.archived_at && item.name.toLocaleLowerCase("pt-BR") === companyName.toLocaleLowerCase("pt-BR"));
        if (existing) companyId = existing.id;
        else {
          companyId = newId();
          setCompanies((current) => [{ id: companyId!, workspace_id: workspace.id, name: companyName, website: null, instagram: null, segment: null, phone: null, city: null, observations: null, archived_at: null }, ...current]);
        }
      }
      const existing = contacts.find((item) => item.id === editingContactId);
      const values: Contact = { id: editingContactId || newId(), workspace_id: workspace.id, company_id: companyId, name: contactForm.name.trim(), title: contactForm.title || null, phone: contactForm.phone || null, whatsapp: contactForm.whatsapp || contactForm.phone || null, email: contactForm.email || null, instagram: contactForm.instagram || null, linkedin: contactForm.linkedin || null, source: contactForm.source || null, assigned_to: contactForm.assigned_to || null, notes: contactForm.notes || null, created_at: existing?.created_at || new Date().toISOString(), archived_at: existing?.archived_at || null };
      setContacts((current) => editingContactId ? current.map((item) => item.id === editingContactId ? values : item) : [values, ...current]);
      toast.success("Contato salvo neste navegador");
      closeModal();
      return;
    }
    if (!supabase) return;
    setBusy(true);
    let companyId: string | null = null;
    const companyName = contactForm.company.trim();
    if (companyName) {
      const existing = await supabase.from("companies").select("id").eq("workspace_id", workspace.id).ilike("name", companyName).is("archived_at", null).maybeSingle();
      if (existing.error) {
        toast.error("Não consegui verificar a empresa", { description: existing.error.message });
        setBusy(false);
        return;
      }
      if (existing.data) companyId = existing.data.id;
      else {
        const created = await supabase.from("companies").insert({ workspace_id: workspace.id, name: companyName }).select("id").single();
        if (created.error) {
          toast.error("Não consegui cadastrar a empresa", { description: created.error.message });
          setBusy(false);
          return;
        }
        companyId = created.data.id;
      }
    }
    const values = {
      workspace_id: workspace.id, company_id: companyId, name: contactForm.name.trim(), title: contactForm.title || null,
      phone: contactForm.phone || null, whatsapp: contactForm.whatsapp || contactForm.phone || null, email: contactForm.email || null,
      instagram: contactForm.instagram || null, linkedin: contactForm.linkedin || null, source: contactForm.source || null,
      assigned_to: contactForm.assigned_to || null, notes: contactForm.notes || null,
    };
    const { error } = editingContactId
      ? await supabase.from("contacts").update(values).eq("id", editingContactId).eq("workspace_id", workspace.id).select("id").single()
      : await supabase.from("contacts").insert(values);
    if (error) toast.error("Não consegui salvar o contato", { description: error.message });
    else {
      toast.success("Contato salvo");
      setContactForm(emptyContact);
      setEditingContactId(null);
      setModal(null);
      await refreshData();
    }
    setBusy(false);
  };

  const addOpportunity = async (event?: FormEvent<HTMLFormElement>, saveAsDraft = false) => {
    event?.preventDefault();
    if (!workspace || !opportunityForm.title.trim()) {
      toast.error("Informe um título para salvar a oportunidade");
      return;
    }
    const isDraft = saveAsDraft;
    if (demoMode) {
      const existing = opportunities.find((item) => item.id === editingOpportunityId);
      const values: Opportunity = { id: editingOpportunityId || newId(), workspace_id: workspace.id, title: opportunityForm.title.trim(), company_id: opportunityForm.company_id || null, contact_id: opportunityForm.contact_id || null, stage: opportunityForm.stage, amount: Number(opportunityForm.amount || 0), assigned_to: opportunityForm.assigned_to || null, source: opportunityForm.source || null, expected_close_at: opportunityForm.expected_close_at || null, notes: opportunityForm.notes || null, created_at: existing?.created_at || new Date().toISOString(), is_draft: isDraft };
      setOpportunities((current) => editingOpportunityId ? current.map((item) => item.id === editingOpportunityId ? values : item) : [values, ...current]);
      toast.success(isDraft ? "Rascunho salvo neste navegador" : "Oportunidade salva neste navegador");
      closeModal();
      return;
    }
    if (!supabase) return;
    setBusy(true);
    const values = {
      workspace_id: workspace.id, title: opportunityForm.title.trim(), company_id: opportunityForm.company_id || null,
      contact_id: opportunityForm.contact_id || null, stage: opportunityForm.stage, amount: Number(opportunityForm.amount || 0),
      assigned_to: opportunityForm.assigned_to || null, source: opportunityForm.source || null,
      expected_close_at: opportunityForm.expected_close_at || null, notes: opportunityForm.notes || null, is_draft: isDraft,
    };
    const { error } = editingOpportunityId
      ? await supabase.from("opportunities").update(values).eq("id", editingOpportunityId).eq("workspace_id", workspace.id).select("id").single()
      : await supabase.from("opportunities").insert(values);
    if (error) toast.error("Não consegui salvar a oportunidade", { description: error.message });
    else {
      toast.success(isDraft ? "Rascunho salvo" : "Oportunidade salva");
      setOpportunityForm(emptyOpportunity);
      setEditingOpportunityId(null);
      setModal(null);
      await refreshData();
    }
    setBusy(false);
  };

  const addTask = async (event?: FormEvent<HTMLFormElement>, saveDraft = false) => {
    event?.preventDefault();
    if (!workspace || !taskForm.title.trim() || !taskForm.due_at) return;
    if (taskForm.kind !== "Reunião" && !taskForm.contact_id && !taskForm.opportunity_id && !taskForm.company_id) {
      toast.error("Vincule a tarefa a uma empresa, contato ou oportunidade");
      return;
    }
    if (taskForm.kind === "Reunião" && taskForm.end_at && new Date(taskForm.end_at) <= new Date(taskForm.due_at)) return toast.error("O término precisa ser após o início da reunião");
    const meetingStatus = taskForm.kind === "Reunião" ? saveDraft ? "Rascunho" : taskForm.meeting_status : null;
    if (taskForm.kind === "Reunião" && meetingStatus === "Agendada" && tasks.some((item) => item.id !== editingTaskId && item.kind === "Reunião" && item.meeting_status !== "Rascunho" && item.status === "Pendente" && item.assigned_to === (taskForm.assigned_to || null) && new Date(item.due_at) < new Date(taskForm.end_at || new Date(new Date(taskForm.due_at).getTime() + 3600000)) && new Date(item.end_at || new Date(new Date(item.due_at).getTime() + 3600000)) > new Date(taskForm.due_at))) {
      if (!window.confirm("Já existe uma reunião neste horário para o responsável. Deseja salvar mesmo assim?")) return;
    }
    if (demoMode) {
      const existing = tasks.find((item) => item.id === editingTaskId);
      const values: Task = { id: editingTaskId || newId(), workspace_id: workspace.id, title: taskForm.title.trim(), kind: taskForm.kind, contact_id: taskForm.contact_id || null, company_id: taskForm.company_id || null, opportunity_id: taskForm.opportunity_id || null, assigned_to: taskForm.assigned_to || null, due_at: new Date(taskForm.due_at).toISOString(), end_at: taskForm.kind === "Reunião" && taskForm.end_at ? new Date(taskForm.end_at).toISOString() : null, location: taskForm.kind === "Reunião" ? taskForm.location || null : null, participants: taskForm.kind === "Reunião" ? taskForm.participants.split(",").map((item) => item.trim()).filter(Boolean) : [], agenda: taskForm.kind === "Reunião" ? taskForm.agenda || null : null, reminder_at: taskForm.kind === "Reunião" && taskForm.reminder_at ? new Date(taskForm.reminder_at).toISOString() : null, meeting_status: meetingStatus as Task["meeting_status"], priority: taskForm.priority, status: existing?.status || "Pendente", description: taskForm.description || null, created_at: existing?.created_at || new Date().toISOString() };
      setTasks((current) => editingTaskId ? current.map((item) => item.id === editingTaskId ? values : item) : [values, ...current]);
      toast.success(taskForm.kind === "Reunião" ? "Reunião salva no calendário" : "Follow-up salvo neste navegador");
      closeModal();
      return;
    }
    if (!supabase) return;
    setBusy(true);
    const values = {
      workspace_id: workspace.id, title: taskForm.title.trim(), kind: taskForm.kind,
      contact_id: taskForm.contact_id || null, company_id: taskForm.company_id || null, opportunity_id: taskForm.opportunity_id || null,
      assigned_to: taskForm.assigned_to || null, due_at: new Date(taskForm.due_at).toISOString(),
      end_at: taskForm.kind === "Reunião" && taskForm.end_at ? new Date(taskForm.end_at).toISOString() : null,
      location: taskForm.kind === "Reunião" ? taskForm.location || null : null,
      participants: taskForm.kind === "Reunião" ? taskForm.participants.split(",").map((item) => item.trim()).filter(Boolean) : [],
      agenda: taskForm.kind === "Reunião" ? taskForm.agenda || null : null,
      reminder_at: taskForm.kind === "Reunião" && taskForm.reminder_at ? new Date(taskForm.reminder_at).toISOString() : null, meeting_status: meetingStatus,
      priority: taskForm.priority, status: editingTaskId ? tasks.find((item) => item.id === editingTaskId)?.status || "Pendente" : "Pendente", description: taskForm.description || null,
    };
    const { error } = editingTaskId
      ? await supabase.from("tasks").update(values).eq("id", editingTaskId).eq("workspace_id", workspace.id).select("id").single()
      : await supabase.from("tasks").insert(values);
    if (error) toast.error("Não consegui agendar a tarefa", { description: error.message });
    else {
      toast.success(taskForm.kind === "Reunião" ? "Reunião salva no calendário" : "Follow-up agendado");
      setTaskForm(emptyTask);
      setEditingTaskId(null);
      setModal(null);
      await refreshData();
    }
    setBusy(false);
  };

  const addInteraction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!workspace || !interactionForm.summary.trim()) return;
    if (!interactionForm.contact_id && !interactionForm.opportunity_id) {
      toast.error("Vincule a interação a um contato ou a uma oportunidade");
      return;
    }
    const completedTask = tasks.find((item) => item.id === resultTaskId);
    const nextTask = scheduleNext ? { ...emptyTask, contact_id: interactionForm.contact_id, opportunity_id: interactionForm.opportunity_id, assigned_to: completedTask?.assigned_to || "", kind: interactionForm.kind === "Nota" ? "Ligação" : interactionForm.kind, title: `Retomar contato — ${contacts.find((item) => item.id === interactionForm.contact_id)?.name || opportunities.find((item) => item.id === interactionForm.opportunity_id)?.title || "lead"}` } : null;
    const afterSave = async () => {
      let completionFailed = false;
      if (completedTask) {
        if (demoMode) setTasks((current) => current.map((item) => item.id === completedTask.id ? { ...item, status: "Concluída", completed_at: new Date().toISOString(), meeting_status: item.kind === "Reunião" ? "Realizada" : item.meeting_status } : item));
        else if (supabase) {
          const { error } = await supabase.from("tasks").update({ status: "Concluída", completed_at: new Date().toISOString(), ...(completedTask.kind === "Reunião" ? { meeting_status: "Realizada" } : {}) }).eq("id", completedTask.id).eq("workspace_id", workspace.id).select("id").single();
          if (error) completionFailed = true;
        }
      }
      if (!demoMode) await refreshData();
      closeModal();
      if (completionFailed) toast.error("A conversa foi salva, mas a tarefa não pôde ser concluída. Conclua-a pela lista de follow-ups.");
      else {
        const relatedCompany = contacts.find((item) => item.id === interactionForm.contact_id)?.company_id || opportunities.find((item) => item.id === interactionForm.opportunity_id)?.company_id;
        toast.success("Conversa registrada no histórico" + (completedTask ? " e follow-up concluído" : ""), relatedCompany ? { action: { label: "Registrar diagnóstico", onClick: () => openDiagnostic(relatedCompany, interactionForm.contact_id || undefined) } } : undefined);
      }
      if (nextTask) { setTaskForm(nextTask); setModal("task"); toast.message("Agora defina a data e o horário do próximo contato."); }
    };
    if (demoMode) {
      const createdAt = new Date().toISOString();
      setInteractions((current) => [{ id: newId(), workspace_id: workspace.id, contact_id: interactionForm.contact_id || null, opportunity_id: interactionForm.opportunity_id || null, kind: interactionForm.kind, summary: interactionForm.summary.trim(), result: interactionForm.result || null, occurred_at: createdAt, created_at: createdAt }, ...current]);
      await afterSave();
      return;
    }
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from("interactions").insert({
      workspace_id: workspace.id, contact_id: interactionForm.contact_id || null,
      opportunity_id: interactionForm.opportunity_id || null, kind: interactionForm.kind,
      summary: interactionForm.summary.trim(), result: interactionForm.result || null,
      occurred_at: new Date().toISOString(),
    });
    if (error) toast.error("Não consegui salvar a interação", { description: error.message });
    else {
      await afterSave();
    }
    setBusy(false);
  };

  const registerTaskResult = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (!task.contact_id && !task.opportunity_id) {
      if (task.company_id) { void completeTask(task.id); return; }
      toast.error("Associe este follow-up a uma empresa, contato ou oportunidade antes de concluí-lo."); return;
    }
    setResultTaskId(task.id);
    setScheduleNext(false);
    setInteractionForm({ contact_id: task.contact_id || "", opportunity_id: task.opportunity_id || "", kind: task.kind === "Tarefa" ? "Nota" : task.kind, summary: "", result: "" });
    setModal("interaction");
  };

  const updateOpportunityStage = async (opportunityId: string, stage: string) => {
    if (!workspace) return;
    if ((stage === "Ganho" || stage === "Perdido") && !window.confirm(`Mover a oportunidade para “${stage}”?`)) return;
    if (demoMode) {
      setOpportunities((current) => current.map((item) => item.id === opportunityId ? { ...item, stage } : item));
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.from("opportunities").update({ stage }).eq("id", opportunityId).eq("workspace_id", workspace.id).select("id").single();
    if (error) toast.error("Não consegui atualizar a etapa", { description: error.message });
    else await refreshData();
  };

  const toggleOpportunityDraft = async (opportunity: Opportunity) => {
    if (!workspace) return;
    const nextDraft = !opportunity.is_draft;
    if (demoMode) {
      setOpportunities((current) => current.map((item) => item.id === opportunity.id ? { ...item, is_draft: nextDraft } : item));
      toast.success(nextDraft ? "Oportunidade movida para rascunhos" : "Oportunidade publicada no funil");
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.from("opportunities").update({ is_draft: nextDraft }).eq("id", opportunity.id).eq("workspace_id", workspace.id).select("id").single();
    if (error) toast.error("Não consegui alterar o rascunho", { description: error.message });
    else {
      toast.success(nextDraft ? "Oportunidade movida para rascunhos" : "Oportunidade publicada no funil");
      await refreshData();
    }
  };

  const deleteOpportunity = async (opportunity: Opportunity) => {
    if (!workspace || !window.confirm(`Excluir o card “${opportunity.title}”? As tarefas e interações vinculadas também serão excluídas. Esta ação não pode ser desfeita.`)) return;
    if (demoMode) {
      setOpportunities((current) => current.filter((item) => item.id !== opportunity.id));
      setTasks((current) => current.filter((item) => item.opportunity_id !== opportunity.id));
      setInteractions((current) => current.filter((item) => item.opportunity_id !== opportunity.id));
      if (detailOpportunityId === opportunity.id) closeModal();
      toast.success("Card excluído");
      return;
    }
    if (!supabase) return;
    const { error } = await supabase.from("opportunities").delete().eq("id", opportunity.id).eq("workspace_id", workspace.id).select("id").single();
    if (error) toast.error("Não consegui excluir o card", { description: error.message });
    else {
      if (detailOpportunityId === opportunity.id) closeModal();
      toast.success("Card excluído");
      await refreshData();
    }
  };

  const openMeetingForm = (date?: Date) => {
    const selected = date ? new Date(date) : new Date(Date.now() + 60 * 60 * 1000);
    if (date) selected.setHours(9, 0, 0, 0);
    const local = new Date(selected.getTime() - selected.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditingTaskId(null);
    const end = new Date(selected.getTime() + 60 * 60 * 1000);
    setTaskForm({ ...emptyTask, title: "Reunião", kind: "Reunião", due_at: local, end_at: new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16) });
    setModal("task");
  };

  const completeTask = async (taskId: string) => {
    if (!workspace) return;
    const meeting = tasks.find((item) => item.id === taskId && item.kind === "Reunião");
    const offerMeetingNotes = () => {
      if (!meeting?.contact_id && !meeting?.opportunity_id) return;
      setInteractionForm({ contact_id: meeting.contact_id || "", opportunity_id: meeting.opportunity_id || "", kind: "Reunião", summary: `Reunião: ${meeting.title}`, result: "" });
      setModal("interaction");
      toast.message("Reunião realizada. Registre o resultado e os próximos passos, se desejar.");
    };
    if (demoMode) {
      setTasks((current) => current.map((item) => item.id === taskId ? { ...item, status: "Concluída", completed_at: new Date().toISOString(), meeting_status: item.kind === "Reunião" ? "Realizada" : item.meeting_status } : item));
      toast.success("Tarefa concluída");
      offerMeetingNotes();
      return;
    }
    if (!supabase) return;
    const current = tasks.find((item) => item.id === taskId);
    const { error } = await supabase.from("tasks").update({ status: "Concluída", completed_at: new Date().toISOString(), ...(current?.kind === "Reunião" ? { meeting_status: "Realizada" } : {}) }).eq("id", taskId).eq("workspace_id", workspace.id).select("id").single();
    if (error) toast.error("Não consegui concluir a tarefa", { description: error.message });
    else {
      toast.success("Tarefa concluída");
      await refreshData();
      offerMeetingNotes();
    }
  };

  const openWhatsApp = (phone?: string | null) => {
    const number = (phone || "").replace(/\D/g, "");
    if (!number) return toast.error("Este contato ainda não tem telefone");
    window.open(`https://wa.me/${number.startsWith("55") ? number : `55${number}`}`, "_blank", "noopener,noreferrer");
  };

  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const contactById = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts]);
  const opportunityById = useMemo(() => new Map(opportunities.map((opportunity) => [opportunity.id, opportunity])), [opportunities]);
  const relatedOpportunities = (companyId?: string | null, contactId?: string | null) => {
    const selectedCompany = companyId || contacts.find((contact) => contact.id === contactId)?.company_id;
    return opportunities.filter((opportunity) => selectedCompany
      ? opportunity.company_id === selectedCompany || (!opportunity.company_id && Boolean(opportunity.contact_id) && contacts.some((contact) => contact.id === opportunity.contact_id && contact.company_id === selectedCompany))
      : contactId ? opportunity.contact_id === contactId : true);
  };
  const detailContact = contacts.find((item) => item.id === detailContactId);
  const detailOpportunity = opportunities.find((item) => item.id === detailOpportunityId);
  const pendingTasks = tasks.filter((task) => task.status === "Pendente" && !task.archived_at);
  const lateTasks = pendingTasks.filter(taskIsLate);
  const filteredContacts = contacts.filter((contact) => {
    const companyName = companyById.get(contact.company_id || "")?.name || "";
    const query = search.trim().toLowerCase();
    return (!contactCompanyFilter || contact.company_id === contactCompanyFilter)
      && (!contactSourceFilter || contact.source === contactSourceFilter)
      && (!query || [contact.name, companyName, contact.email, contact.phone, contact.whatsapp].some((value) => (value || "").toLowerCase().includes(query)));
  });
  const filteredOpportunities = opportunities.filter((opportunity) => {
    const contact = contactById.get(opportunity.contact_id || "");
    const company = companyById.get(opportunity.company_id || "");
    const query = search.trim().toLowerCase();
    return (!opportunityStageFilter || opportunity.stage === opportunityStageFilter)
      && (!opportunityAssignedFilter || opportunity.assigned_to === opportunityAssignedFilter)
      && (!query || [opportunity.title, company?.name, contact?.name, opportunity.stage].some((value) => (value || "").toLowerCase().includes(query)));
  });
  const filteredTasks = tasks.filter((task) => {
    const contact = contactById.get(task.contact_id || "");
    const query = search.trim().toLowerCase();
    return !task.archived_at && (!taskStatusFilter || task.status === taskStatusFilter)
      && (!query || [task.title, task.kind, contact?.name, task.assigned_to].some((value) => (value || "").toLowerCase().includes(query)));
  });

  const saveBoardActivity = async (item: Partial<BoardActivity>): Promise<boolean> => {
    if (!workspace || !canEdit || !item.title?.trim() || !item.column_id) return false;
    const values = {
      workspace_id: workspace.id, column_id: item.column_id, title: item.title.trim(), description: item.description || null,
      assigned_to: item.assigned_to || null, priority: item.priority || "Média", start_at: item.start_at || null,
      due_at: item.due_at || null, labels: item.labels || [], checklist: item.checklist || [],
      contact_id: item.contact_id || null, company_id: item.company_id || null, opportunity_id: item.opportunity_id || null,
      status: item.status || "published", position: item.position ?? Date.now(),
    };
    if (demoMode) {
      const now = new Date().toISOString();
      const next = { ...values, id: item.id || newId(), created_by: item.created_by || user?.id || null, created_at: item.created_at || now, updated_at: now, comments: item.comments || [] } as BoardActivity;
      setActivities((current) => item.id ? current.map((x) => x.id === item.id ? next : x) : [...current, next]);
      toast.success("Atividade salva neste navegador");
      return true;
    }
    if (!supabase) return false;
    setBusy(true);
    const result = item.id ? await supabase.from("board_activities").update(values).eq("id", item.id).eq("workspace_id", workspace.id).select("id").single()
      : await supabase.from("board_activities").insert({ ...values, created_by: user?.id }).select("id").single();
    setBusy(false);
    if (result.error) { toast.error("Não foi possível salvar a atividade", { description: result.error.message }); return false; }
    toast.success("Atividade salva");
    await refreshData();
    return true;
  };
  const removeBoardActivity = async (item: BoardActivity) => {
    if (!workspace || !canEdit || !window.confirm(`Excluir definitivamente “${item.title}”?`)) return;
    if (demoMode) { setActivities((current) => current.filter((x) => x.id !== item.id)); toast.success("Atividade excluída"); return; }
    if (!supabase) return;
    const { error } = await supabase.from("board_activities").delete().eq("id", item.id).eq("workspace_id", workspace.id);
    if (error) toast.error("Não foi possível excluir a atividade", { description: error.message });
    else { toast.success("Atividade excluída"); await refreshData(); }
  };
  const saveBoardColumn = async (item: Partial<ActivityColumn>) => {
    if (!workspace || !canEdit || !item.title?.trim()) return;
    const values = { workspace_id: workspace.id, title: item.title.trim(), position: item.position ?? columns.length, archived_at: item.archived_at || null };
    if (demoMode) { const next = { ...values, id: item.id || newId() } as ActivityColumn; setColumns((current) => item.id ? current.map((x) => x.id === item.id ? next : x) : [...current, next]); return; }
    if (!supabase) return;
    const result = item.id ? await supabase.from("activity_columns").update(values).eq("id", item.id).eq("workspace_id", workspace.id) : await supabase.from("activity_columns").insert(values);
    if (result.error) toast.error("Não foi possível salvar a coluna", { description: result.error.message }); else await refreshData();
  };
  const archiveBoardColumn = async (item: ActivityColumn) => {
    if (activities.some((x) => x.column_id === item.id)) { toast.error("Mova os cartões antes de arquivar a coluna"); return; }
    if (!window.confirm(`Arquivar a coluna “${item.title}”?`)) return;
    if (demoMode) { setColumns((current) => current.map((x) => x.id === item.id ? { ...x, archived_at: new Date().toISOString() } : x)); return; }
    if (!supabase || !workspace) return;
    const { error } = await supabase.from("activity_columns").update({ archived_at: new Date().toISOString() }).eq("id", item.id).eq("workspace_id", workspace.id);
    if (error) toast.error("Não foi possível arquivar a coluna", { description: error.message }); else await refreshData();
  };
  const addBoardComment = async (item: BoardActivity, body: string) => {
    if (!workspace || !user || !canEdit || !body.trim()) return;
    const comment = { id: newId(), author_id: user.id, author_name: members.find((x) => x.user_id === user.id)?.display_name || user.email || "Equipe", body: body.trim(), created_at: new Date().toISOString() };
    if (demoMode) { setActivities((current) => current.map((x) => x.id === item.id ? { ...x, comments: [...x.comments, comment] } : x)); toast.success("Comentário registrado"); return; }
    if (!supabase) return;
    const { error } = await supabase.from("activity_comments").insert({ workspace_id: workspace.id, activity_id: item.id, author_id: user.id, author_name: comment.author_name, body: comment.body });
    if (error) toast.error("Não foi possível comentar", { description: error.message }); else { toast.success("Comentário registrado"); await refreshData(); }
  };

  const startDemo = () => {
    const saved = window.localStorage.getItem(demoStorageKey);
    if (saved) {
      try {
        const data = JSON.parse(saved) as { companies?: Company[]; contacts?: Contact[]; opportunities?: Opportunity[]; tasks?: Task[]; interactions?: Interaction[]; columns?: ActivityColumn[]; activities?: BoardActivity[]; diagnostics?: CompanyDiagnostic[] };
        setCompanies(data.companies || demoCompanies);
        setContacts(data.contacts || demoContacts);
        setOpportunities(data.opportunities || demoOpportunities);
        setTasks(data.tasks || demoTasks);
        setInteractions(data.interactions || demoInteractions);
        setColumns(data.columns?.length ? data.columns : demoColumns);
        setActivities(data.activities || []);
        setDiagnostics(data.diagnostics || []);
      } catch {
        setCompanies(demoCompanies); setContacts(demoContacts); setOpportunities(demoOpportunities); setTasks(demoTasks); setInteractions(demoInteractions); setColumns(demoColumns); setActivities([]); setDiagnostics([]);
      }
    } else {
      setCompanies(demoCompanies); setContacts(demoContacts); setOpportunities(demoOpportunities); setTasks(demoTasks); setInteractions(demoInteractions); setColumns(demoColumns); setActivities([]); setDiagnostics([]);
    }
    setDemoMode(true);
    setWorkspace(demoWorkspace);
    setRole("superadmin");
    setMembers([{ workspace_id: demoWorkspace.id, user_id: "demo-owner", role: "superadmin", display_name: "Visitante (demonstração)", email: null, joined_at: new Date().toISOString() }]);
  };

  if (!supabase && !demoMode) {
    return <SetupRequired onPreview={process.env.NODE_ENV === "development" ? startDemo : undefined} />;
  }

  if (authLoading) {
    return <CenteredLoading label="Abrindo seu CRM" />;
  }

  if ((!session && !demoMode) || authMode === "updatePassword") {
    return <>
      <Toaster richColors position="top-right" />
      <AuthScreen mode={authMode} setMode={setAuthMode} onSubmit={authenticate} name={authName} setName={setAuthName} email={authEmail} setEmail={setAuthEmail} password={authPassword} setPassword={setAuthPassword} message={authMessage} busy={busy} invite={hasPendingInvite} allowSignup={bootstrapAvailable === true} />
    </>;
  }

  if (workspaceLoading) return <CenteredLoading label="Carregando clientes e oportunidades" />;

  if (!workspace) {
    return <>
      <Toaster richColors position="top-right" />
      {accessError ? <AccessRestricted message={accessError} onRetry={() => void loadMembership()} onSignOut={signOut} /> : bootstrapAvailable ? <WorkspaceSetup userName={user?.user_metadata?.full_name || user?.email || ""} workspaceName={workspaceName} setWorkspaceName={setWorkspaceName} onSubmit={createWorkspace} busy={busy} /> : <AccessRestricted onSignOut={signOut} />}
    </>;
  }

  return <>
    <Toaster richColors position="top-right" />
    <SidebarProvider>
      <Sidebar collapsible="offcanvas" className="border-r-0 bg-[#10233f] text-white">
        <SidebarHeader className="px-5 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#c5a56a] text-lg font-bold text-white shadow-lg shadow-[#081426]/20">S</span>
            <div className="min-w-0"><p className="truncate text-lg font-semibold tracking-tight text-white">Stormfy</p><p className="truncate text-xs text-[#ddc99e]">{workspace.name}</p></div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-3 pt-5">
          <SidebarGroup>
            <SidebarGroupLabel className="px-3 text-[11px] font-semibold uppercase tracking-[0.13em] text-[#d2ba84]">Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <CrmNavigation activeView={activeView} setActiveView={setActiveView} clearSearch={() => setSearch("")} lateCount={lateTasks.length} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <div className="mx-3 my-5"><Separator className="bg-white/10" /></div>
          <div className="mx-3 rounded-xl border border-white/10 bg-white/[0.06] p-3.5">
            <div className="flex items-center gap-2 text-sm font-medium text-white"><BadgeCheck className="size-4 text-[#d2ba84]" />Base compartilhada</div>
            <p className="mt-2 text-xs leading-5 text-[#ddc99e]">{demoMode ? "Prévia neste navegador; os dados ainda não são compartilhados." : "A equipe autorizada compartilha os registros comerciais."}</p>
          </div>
        </SidebarContent>
        <SidebarFooter className="border-t border-white/10 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-9 border border-white/15"><AvatarFallback className="bg-[#c5a56a] text-xs font-semibold text-white">{initials(user?.user_metadata?.full_name || user?.email)}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{user?.user_metadata?.full_name || user?.email}</p><p className="truncate text-xs text-[#d2ba84]">{role === "superadmin" ? "Superadministrador" : role === "admin" ? "Administrador" : role === "reader" ? "Leitor" : "Membro da equipe"}</p></div>
            <Button type="button" size="icon" variant="ghost" aria-label="Sair do CRM" title="Sair" className="text-[#ddc99e] hover:bg-white/10 hover:text-white" onClick={signOut}><LogOut className="size-4" /></Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-[#f7f3ea]">
        {demoMode && <div className="border-b border-[#ddc99e] bg-[#f6f0e3] px-4 py-2 text-center text-xs font-medium text-[#173052]">Acesso local · dados de demonstração; suas alterações ficam salvas neste navegador.</div>}
        {!demoMode && localBackupCount > 0 && canEdit && <div className="flex flex-wrap items-center justify-center gap-3 border-b border-[#ddc99e] bg-[#f6f0e3] px-4 py-2 text-sm text-[#173052]"><span><strong>{localBackupCount} contatos encontrados.</strong> Eles continuam salvos neste navegador e ainda precisam ser enviados para a base compartilhada.</span><Button size="sm" variant="outline" disabled={importing} onClick={() => setRecoveryDialogOpen(true)}>{importing ? "Recuperando..." : "Recuperar agora"}</Button></div>}
        <header className="sticky top-0 z-20 flex h-[64px] min-w-0 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:h-[72px] sm:gap-3 sm:px-7">
          <SidebarTrigger className="md:hidden" />
          <div className="relative min-w-0 max-w-[510px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no CRM" aria-label="Buscar contato, empresa ou tarefa" className="h-10 min-w-0 rounded-lg border-slate-200 bg-slate-50 pl-9 sm:placeholder:text-sm" />
          </div>
          <Button type="button" variant="outline" className="hidden h-10 border-slate-200 bg-white sm:inline-flex" onClick={() => setModal("interaction")}><Activity className="size-4 text-[#173052]" /> Registrar interação</Button>
          <Button type="button" className="h-10 shrink-0 bg-[#173052] px-3 text-white hover:bg-[#10233f] sm:px-4" aria-label="Novo contato" onClick={() => setModal("contact")}><Plus className="size-4" /><span className="hidden sm:inline">Novo contato</span></Button>
        </header>
        <div className="mx-auto w-full min-w-0 max-w-[1600px] px-3 py-5 sm:px-7 sm:py-8">
          {dataError && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><span>{dataError}</span><Button type="button" variant="outline" onClick={() => void refreshData()}>Tentar novamente</Button></div>}
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-sm font-medium text-[#173052]">CRM comercial</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[28px]">{navItems.find((item) => item.id === activeView)?.label}</h1><p className="mt-1 text-sm text-slate-500">Acompanhe a conversa e mantenha o próximo passo definido.</p></div>
            <div className="flex flex-wrap gap-2 max-sm:[&>button]:flex-1">
              <Button type="button" variant="outline" className="border-slate-200 bg-white" onClick={() => activeView === "calendar" ? openMeetingForm() : setModal("task")}><CalendarClock className="size-4 text-[#173052]" /> {activeView === "calendar" ? "Agendar reunião" : "Agendar follow-up"}</Button>
              {activeView === "pipeline" && <Button type="button" className="bg-[#173052] text-white hover:bg-[#10233f]" onClick={() => setModal("opportunity")}><Plus className="size-4" /> Nova oportunidade</Button>}
            </div>
          </div>

          {activeView === "dashboard" && <DashboardView contacts={contacts} companies={companies.filter((item) => !item.archived_at)} opportunities={opportunities} tasks={tasks.filter((item) => !item.archived_at)} interactions={interactions} activities={activities} diagnostics={diagnostics} onView={(view) => { if (view === "tasks") setTaskStatusFilter("Pendente"); setActiveView(view); }} onCreateTask={() => setModal("task")} onCreateMeeting={() => openMeetingForm()} onCreateActivity={() => { setActiveView("activities"); setActivityCreateRequest((current) => current + 1); }} onCreateCompany={() => setModal("company")} onCreateDiagnostic={() => openDiagnostic()} onCompanyDetail={(id) => setDetailCompanyId(id)} onCompleteTask={registerTaskResult} onCreateOpportunity={() => setModal("opportunity")} onCreateContact={() => setModal("contact")} onCreateInteraction={() => setModal("interaction")} onContactDetail={(id) => { setDetailContactId(id); setModal("contactDetail"); }} onOpportunityDetail={(id) => { setDetailOpportunityId(id); setModal("opportunityDetail"); }} onOpenStage={(stage) => { setOpportunityStageFilter(stage); setOpportunityAssignedFilter(""); setActiveView("pipeline"); }} />}
{(activeView === "contacts" || activeView === "companies") && <ContactsView key={activeView} initialTab={activeView === "companies" ? "companies" : "people"} contacts={activeView === "companies" ? contacts : filteredContacts} diagnostics={diagnostics} tasks={tasks} canEdit={canEdit} companies={companies.filter((item) => !search.trim() || item.name.toLowerCase().includes(search.trim().toLowerCase()))} companyFilter={contactCompanyFilter} setCompanyFilter={setContactCompanyFilter} sourceFilter={contactSourceFilter} setSourceFilter={setContactSourceFilter} sources={[...new Set(contacts.map((item) => item.source).filter((value): value is string => Boolean(value)))]} onCreate={() => setModal("contact")} onCreateCompany={() => setModal("company")} onEditCompany={editCompany} onCompanyDetail={(id) => setDetailCompanyId(id)} onRegisterVisit={(id) => openDiagnostic(id)} onContactVisit={(companyId, contactId) => openDiagnostic(companyId,contactId)} onArchiveCompany={(item) => archiveRecord("companies", item.id, item.name)} onRestoreCompany={restoreCompany} onEdit={editContact} onArchive={(item) => archiveRecord("contacts", item.id, item.name)} onDetail={(id) => { setDetailContactId(id); setModal("contactDetail"); }} onWhatsApp={openWhatsApp} onImport={importInitialContacts} importing={importing} onAddInteraction={(contactId) => { setInteractionForm((current) => ({ ...current, contact_id: contactId })); setModal("interaction"); }} onAddTask={(contactId) => { setTaskForm((current) => ({ ...current, contact_id: contactId })); setModal("task"); }} />}
          {activeView === "pipeline" && <PipelineView opportunities={filteredOpportunities} contacts={contactById} companies={companyById} draggedId={draggedOpportunity} setDraggedId={setDraggedOpportunity} onMove={updateOpportunityStage} onCreate={() => setModal("opportunity")} onEdit={editOpportunity} onDetail={(id) => { setDetailOpportunityId(id); setModal("opportunityDetail"); }} onToggleDraft={toggleOpportunityDraft} onDelete={deleteOpportunity} stageFilter={opportunityStageFilter} setStageFilter={setOpportunityStageFilter} assignedFilter={opportunityAssignedFilter} setAssignedFilter={setOpportunityAssignedFilter} assignees={[...new Set(opportunities.map((item) => item.assigned_to).filter((value): value is string => Boolean(value)))]} />}
          {activeView === "tasks" && <TasksView tasks={filteredTasks} contacts={contactById} opportunities={opportunityById} onCreate={() => setModal("task")} onComplete={registerTaskResult} onEdit={editTask} onCancel={cancelTask} statusFilter={taskStatusFilter} setStatusFilter={setTaskStatusFilter} />}
          {activeView === "activities" && <ActivityBoard columns={columns} activities={activities} contacts={contacts} companies={companies} opportunities={opportunities} userId={user?.id || ""} canEdit={canEdit} isSuperadmin={role === "superadmin"} createRequestToken={activityCreateRequest} busy={busy} onSave={saveBoardActivity} onRemove={removeBoardActivity} onSaveColumn={saveBoardColumn} onRemoveColumn={archiveBoardColumn} onAddComment={addBoardComment} />}
          {activeView === "calendar" && <CalendarView tasks={tasks} contacts={contactById} companies={companyById} opportunities={opportunityById} onCreateMeeting={openMeetingForm} onEdit={editTask} onComplete={completeTask} onCancel={cancelTask} onArchive={archiveMeeting} onDelete={deleteMeeting} canEdit={canEdit} canDelete={role === "superadmin" || role === "admin"} onOpenRelated={(task) => { if (task.opportunity_id) { setDetailOpportunityId(task.opportunity_id); setModal("opportunityDetail"); } else if (task.contact_id) { setDetailContactId(task.contact_id); setModal("contactDetail"); } }} />}
          {activeView === "team" && <TeamManagement workspace={workspace} members={members} invites={invites} audit={teamAudit} role={role} userId={user?.id || ""} email={user?.email || ""} inviteEmail={inviteEmail} inviteRole={inviteRole} setInviteEmail={setInviteEmail} setInviteRole={setInviteRole} onInvite={createInvite} onChangeRole={changeMemberRole} onRemove={removeMember} onRevoke={revokeInvite} busy={busy} demo={demoMode} />}
        </div>
      </SidebarInset>

      <Dialog open={!demoMode && Boolean(workspace) && !workspaceLoading && localBackupCount > 0 && recoveryDialogOpen} onOpenChange={setRecoveryDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Seus contatos ainda estão neste navegador</DialogTitle>
            <DialogDescription className="leading-6">
              Encontramos {localBackupCount} contato{localBackupCount === 1 ? "" : "s"} salvo{localBackupCount === 1 ? "" : "s"} no modo anterior do Stormfy. Recupere agora para que Ismael e Rudy vejam os mesmos registros em qualquer dispositivo.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-[#eadbb9] bg-[#f6f0e3] p-4 text-sm leading-6 text-[#173052]">
            A importação evita duplicidades e preserva a cópia local. Nenhum contato existente no banco será apagado.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={importing} onClick={() => setRecoveryDialogOpen(false)}>Agora não</Button>
            <Button type="button" disabled={importing} className="bg-[#173052] text-white hover:bg-[#10233f]" onClick={() => void importLocalContacts(true)}>
              {importing ? <><LoaderCircle className="size-4 animate-spin" /> Recuperando...</> : `Recuperar ${localBackupCount} contato${localBackupCount === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>

    {diagnosticEditor && <CompanyDiagnosticEditor key={diagnosticEditor.item?.id || diagnosticEditor.meeting?.id || `${diagnosticEditor.companyId || "new"}-${diagnosticEditor.contactId || ""}`} initial={diagnosticEditor.item} meeting={diagnosticEditor.meeting}
      companyId={diagnosticEditor.companyId} contactId={diagnosticEditor.contactId}
      companies={companies} contacts={contacts} responsible={user?.user_metadata?.full_name || ""} authToken={session?.access_token} aiEnabled={aiEnabled}
      onSave={saveDiagnostic} onQuickCreate={quickCreateCompany} onClose={() => setDiagnosticEditor(null)} />}

    <Dialog open={Boolean(detailCompanyId)} onOpenChange={(open) => { if (!open) setDetailCompanyId(null); }}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle>{companies.find((item) => item.id === detailCompanyId)?.name || "Empresa"}</DialogTitle>
          <DialogDescription>Negócio, visitas, oportunidades e próximos passos em um só lugar.</DialogDescription></DialogHeader>
        {detailCompanyId && companies.find((item) => item.id === detailCompanyId) && <CompanyProfile key={detailCompanyId}
          company={companies.find((item) => item.id === detailCompanyId)!}
          contacts={contacts.filter((item) => item.company_id === detailCompanyId)}
          diagnostics={diagnostics.filter((item) => item.company_id === detailCompanyId)}
          opportunities={relatedOpportunities(detailCompanyId)}
          tasks={tasks.filter((item) => item.company_id === detailCompanyId || contacts.some((c) => c.company_id === detailCompanyId && c.id === item.contact_id))}
          interactions={interactions.filter((item) => contacts.some((c) => c.company_id === detailCompanyId && c.id === item.contact_id) || relatedOpportunities(detailCompanyId).some((o) => o.id === item.opportunity_id))}
          canEdit={canEdit} onRegister={(meeting) => openDiagnostic(detailCompanyId,meeting?.contact_id || undefined,undefined,meeting)} onEditDiagnostic={(item) => openDiagnostic(item.company_id,item.contact_id || undefined,item)}
          onArchiveDiagnostic={(item) => { if (window.confirm("Arquivar este diagnóstico? Ele continuará no histórico da empresa.")) void saveDiagnostic({ ...diagnosticFormFromRecord(item), status: "archived", schedule_task: false },item.id); }}
          onOpenAttachment={openMeetingAttachment}
          onCreateOpportunity={createOpportunityFromDiagnosis}
          onAddTask={(contactId) => { setTaskForm({ ...emptyTask, company_id: detailCompanyId, contact_id: contactId || "", title: `Retomar contato — ${companies.find((c) => c.id === detailCompanyId)?.name || "empresa"}` }); setDetailCompanyId(null); setModal("task"); }}
          onAddInteraction={(contactId) => { if (!contactId) { toast.error("Vincule um contato à empresa para registrar a conversa."); return; } setInteractionForm((current) => ({ ...current, contact_id: contactId })); setDetailCompanyId(null); setModal("interaction"); }}
          onEditCompany={() => { const company = companies.find((item) => item.id === detailCompanyId); if (company) { setDetailCompanyId(null); editCompany(company); } }} />}
      </DialogContent>
    </Dialog>

    <Dialog open={modal === "company"} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{editingCompanyId ? "Editar empresa" : "Nova empresa"}</DialogTitle><DialogDescription>Dados da empresa para acompanhar seus contatos.</DialogDescription></DialogHeader>
        <form onSubmit={saveCompany} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome *"><Input required value={companyForm.name} onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })} /></Field>
            <Field label="Segmento"><Input value={companyForm.segment} onChange={(event) => setCompanyForm({ ...companyForm, segment: event.target.value })} /></Field>
            <Field label="Site"><Input type="url" value={companyForm.website} onChange={(event) => setCompanyForm({ ...companyForm, website: event.target.value })} placeholder="https://" /></Field>
            <Field label="Instagram"><Input type="url" value={companyForm.instagram} onChange={(event) => setCompanyForm({ ...companyForm, instagram: event.target.value })} placeholder="https://instagram.com/..." /></Field>
            <Field label="Telefone"><Input type="tel" value={companyForm.phone} onChange={(event) => setCompanyForm({ ...companyForm, phone: event.target.value })} /></Field>
            <Field label="Cidade"><Input value={companyForm.city} onChange={(event) => setCompanyForm({ ...companyForm, city: event.target.value })} /></Field>
          </div>
          <Field label="Observações"><Textarea rows={3} value={companyForm.observations} onChange={(event) => setCompanyForm({ ...companyForm, observations: event.target.value })} /></Field>
          <DialogFooter><Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button><Button disabled={busy} className="bg-[#173052] text-white hover:bg-[#10233f]">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Salvar empresa</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={modal === "contact"} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editingContactId ? "Editar contato" : "Novo contato"}</DialogTitle><DialogDescription>Cadastre a pessoa e os dados úteis para continuar a conversa.</DialogDescription></DialogHeader>
        <form onSubmit={addContact} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome *"><Input required value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} placeholder="Nome do contato" /></Field>
            <Field label="Empresa"><Input value={contactForm.company} onChange={(event) => setContactForm({ ...contactForm, company: event.target.value })} placeholder="Nome da empresa" /></Field>
            <Field label="Cargo"><Input value={contactForm.title} onChange={(event) => setContactForm({ ...contactForm, title: event.target.value })} placeholder="Ex.: Sócio, gerente" /></Field>
            <Field label="Telefone"><Input type="tel" value={contactForm.phone} onChange={(event) => setContactForm({ ...contactForm, phone: event.target.value })} placeholder="(41) 99999-9999" /></Field>
            <Field label="WhatsApp"><Input type="tel" value={contactForm.whatsapp} onChange={(event) => setContactForm({ ...contactForm, whatsapp: event.target.value })} placeholder="Se for diferente do telefone" /></Field>
            <Field label="E-mail"><Input type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} placeholder="nome@empresa.com" /></Field>
            <Field label="Instagram"><Input type="url" value={contactForm.instagram} onChange={(event) => setContactForm({ ...contactForm, instagram: event.target.value })} placeholder="https://instagram.com/..." /></Field>
            <Field label="LinkedIn"><Input type="url" value={contactForm.linkedin} onChange={(event) => setContactForm({ ...contactForm, linkedin: event.target.value })} placeholder="https://linkedin.com/in/..." /></Field>
            <Field label="Origem"><Input value={contactForm.source} onChange={(event) => setContactForm({ ...contactForm, source: event.target.value })} placeholder="Indicação, evento, prospecção..." /></Field>
            <Field label="Responsável"><Input value={contactForm.assigned_to} onChange={(event) => setContactForm({ ...contactForm, assigned_to: event.target.value })} placeholder={user?.email || "Ismael ou Rudy"} /></Field>
          </div>
          <Field label="Observações"><Textarea value={contactForm.notes} onChange={(event) => setContactForm({ ...contactForm, notes: event.target.value })} placeholder="Contexto e informações importantes" rows={3} /></Field>
          <DialogFooter><Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button><Button disabled={busy} className="bg-[#173052] text-white hover:bg-[#10233f]">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Salvar contato</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={modal === "opportunity"} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{editingOpportunityId ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle><DialogDescription>Registre o negócio em andamento e sua etapa atual.</DialogDescription></DialogHeader>
        <form onSubmit={(event) => void addOpportunity(event, false)} className="space-y-4">
          <Field label="Título da oportunidade *"><Input required value={opportunityForm.title} onChange={(event) => setOpportunityForm({ ...opportunityForm, title: event.target.value })} placeholder="Ex.: Site institucional — Metallum" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Empresa"><NativeSelect value={opportunityForm.company_id} onChange={(event) => setOpportunityForm({ ...opportunityForm, company_id: event.target.value })}><option value="">Sem empresa selecionada</option>{companies.filter((item) => !item.archived_at || item.id === opportunityForm.company_id).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</NativeSelect></Field>
            <Field label="Contato"><NativeSelect value={opportunityForm.contact_id} onChange={(event) => setOpportunityForm({ ...opportunityForm, contact_id: event.target.value })}><option value="">Sem contato selecionado</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</NativeSelect></Field>
            <Field label="Etapa"><NativeSelect value={opportunityForm.stage} onChange={(event) => setOpportunityForm({ ...opportunityForm, stage: event.target.value })}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</NativeSelect></Field>
            <Field label="Valor estimado (R$)"><Input type="number" min="0" step="0.01" value={opportunityForm.amount} onChange={(event) => setOpportunityForm({ ...opportunityForm, amount: event.target.value })} placeholder="0" /></Field>
            <Field label="Responsável"><Input value={opportunityForm.assigned_to} onChange={(event) => setOpportunityForm({ ...opportunityForm, assigned_to: event.target.value })} placeholder={user?.email || "Ismael ou Rudy"} /></Field>
            <Field label="Previsão de fechamento"><Input type="date" value={opportunityForm.expected_close_at} onChange={(event) => setOpportunityForm({ ...opportunityForm, expected_close_at: event.target.value })} /></Field>
            <Field label="Origem"><Input value={opportunityForm.source} onChange={(event) => setOpportunityForm({ ...opportunityForm, source: event.target.value })} placeholder="Como surgiu a oportunidade" /></Field>
          </div>
          <Field label="Observações"><Textarea rows={3} value={opportunityForm.notes} onChange={(event) => setOpportunityForm({ ...opportunityForm, notes: event.target.value })} placeholder="Contexto, escopo ou próximos passos" /></Field>
          <DialogFooter className="flex-wrap"><Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button><Button type="button" variant="outline" disabled={busy} className="border-[#d2ba84] text-[#173052]" onClick={() => void addOpportunity(undefined, true)}><Pencil className="size-4" /> Salvar rascunho</Button><Button type="submit" disabled={busy} className="bg-[#173052] text-white hover:bg-[#10233f]">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} {opportunityForm.is_draft ? "Publicar oportunidade" : "Salvar oportunidade"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={modal === "task"} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{editingTaskId ? `Editar ${taskForm.kind === "Reunião" ? "reunião" : "follow-up"}` : taskForm.kind === "Reunião" ? "Agendar reunião" : "Agendar follow-up"}</DialogTitle><DialogDescription>{taskForm.kind === "Reunião" ? "A reunião salva aparecerá automaticamente no calendário." : "Deixe definido quem fará o contato e quando."}</DialogDescription></DialogHeader>
        <form onSubmit={(event) => void addTask(event)} className="space-y-4">
          <Field label="Título da tarefa *"><Input required value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} placeholder="Ex.: Retornar sobre a proposta" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo"><NativeSelect value={taskForm.kind} onChange={(event) => setTaskForm({ ...taskForm, kind: event.target.value })}>{["Ligação", "WhatsApp", "E-mail", "Reunião", "Tarefa"].map((kind) => <option key={kind}>{kind}</option>)}</NativeSelect></Field>
            <Field label="Data e hora *"><Input required type="datetime-local" value={taskForm.due_at} onChange={(event) => setTaskForm({ ...taskForm, due_at: event.target.value })} /></Field>
            {taskForm.kind === "Reunião" && <><Field label="Término"><Input type="datetime-local" value={taskForm.end_at} onChange={(event) => setTaskForm({ ...taskForm, end_at: event.target.value })} /></Field><Field label="Local ou link"><Input value={taskForm.location} onChange={(event) => setTaskForm({ ...taskForm, location: event.target.value })} placeholder="Endereço ou URL da reunião" /></Field><Field label="Participantes"><Input value={taskForm.participants} onChange={(event) => setTaskForm({ ...taskForm, participants: event.target.value })} placeholder="Nome ou e-mail, separados por vírgula" /></Field><Field label="Lembrete interno"><Input type="datetime-local" value={taskForm.reminder_at} onChange={(event) => setTaskForm({ ...taskForm, reminder_at: event.target.value })} /></Field><Field label="Situação"><NativeSelect value={taskForm.meeting_status} onChange={(event) => setTaskForm({ ...taskForm, meeting_status: event.target.value })}>{["Agendada", "Rascunho", "Realizada", "Cancelada"].map((value) => <option key={value}>{value}</option>)}</NativeSelect></Field></>}
            <Field label="Empresa"><NativeSelect value={taskForm.company_id} onChange={(event) => setTaskForm({ ...taskForm, company_id: event.target.value, contact_id: "", opportunity_id: "" })}><option value="">Sem empresa selecionada</option>{companies.filter((company) => !company.archived_at).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</NativeSelect></Field>
            <Field label="Contato"><NativeSelect value={taskForm.contact_id} onChange={(event) => setTaskForm({ ...taskForm, contact_id: event.target.value, company_id: contacts.find((contact) => contact.id === event.target.value)?.company_id || taskForm.company_id, opportunity_id: "" })}><option value="">Selecione um contato</option>{contacts.filter((contact) => !taskForm.company_id || contact.company_id === taskForm.company_id).map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</NativeSelect></Field>
            <Field label="Oportunidade (opcional)"><NativeSelect value={taskForm.opportunity_id} onChange={(event) => setTaskForm({ ...taskForm, opportunity_id: event.target.value })}><option value="">Sem oportunidade vinculada</option>{relatedOpportunities(taskForm.company_id, taskForm.contact_id).filter((item) => item.stage !== "Ganho" && item.stage !== "Perdido").map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</NativeSelect></Field>
            <Field label="Prioridade"><NativeSelect value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })}>{["Alta", "Média", "Baixa"].map((priority) => <option key={priority}>{priority}</option>)}</NativeSelect></Field>
            <Field label="Responsável"><Input value={taskForm.assigned_to} onChange={(event) => setTaskForm({ ...taskForm, assigned_to: event.target.value })} placeholder={user?.email || "Ismael ou Rudy"} /></Field>
          </div>
          {taskForm.kind === "Reunião" && <Field label="Pauta"><Textarea rows={3} value={taskForm.agenda} onChange={(event) => setTaskForm({ ...taskForm, agenda: event.target.value })} placeholder="Objetivo e assuntos para a reunião" /></Field>}
          <Field label="Descrição"><Textarea rows={3} value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} placeholder="O que precisa acontecer neste contato?" /></Field>
          <DialogFooter><Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>{taskForm.kind === "Reunião" && <Button type="button" variant="outline" disabled={busy} onClick={() => void addTask(undefined, true)}>Salvar rascunho</Button>}<Button disabled={busy} className="bg-[#173052] text-white hover:bg-[#10233f]">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <CalendarClock className="size-4" />} {taskForm.kind === "Reunião" ? "Salvar reunião" : "Agendar"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={modal === "interaction"} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{resultTaskId ? "Como foi esse contato?" : "Registrar conversa"}</DialogTitle><DialogDescription>Registre o que aconteceu. Se houver uma nova etapa, agende o próximo contato em seguida.</DialogDescription></DialogHeader>
        <form onSubmit={addInteraction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo"><NativeSelect value={interactionForm.kind} onChange={(event) => setInteractionForm({ ...interactionForm, kind: event.target.value })}>{["WhatsApp", "Ligação", "E-mail", "Reunião", "Nota"].map((kind) => <option key={kind}>{kind}</option>)}</NativeSelect></Field>
            <Field label="Contato"><NativeSelect value={interactionForm.contact_id} onChange={(event) => setInteractionForm({ ...interactionForm, contact_id: event.target.value, opportunity_id: "" })}><option value="">Selecione um contato</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</NativeSelect></Field>
            <Field label="Oportunidade (opcional)"><NativeSelect value={interactionForm.opportunity_id} onChange={(event) => setInteractionForm({ ...interactionForm, opportunity_id: event.target.value })}><option value="">Sem oportunidade vinculada</option>{relatedOpportunities(null, interactionForm.contact_id).map((opportunity) => <option key={opportunity.id} value={opportunity.id}>{opportunity.title}</option>)}</NativeSelect></Field>
            <Field label="Próximo passo combinado"><Input value={interactionForm.result} onChange={(event) => setInteractionForm({ ...interactionForm, result: event.target.value })} placeholder="Ex.: Enviar proposta; retornar na terça" /></Field>
          </div>
          <Field label="O que aconteceu? *"><Textarea required rows={4} value={interactionForm.summary} onChange={(event) => setInteractionForm({ ...interactionForm, summary: event.target.value })} placeholder="Ex.: Conversei com Rafael, ele pediu para visitar a operação na próxima semana." /></Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#eadbb9] bg-[#f9f5eb] p-4 text-sm text-[#173052]"><input type="checkbox" className="mt-1 size-4 accent-[#173052]" checked={scheduleNext} onChange={(event) => setScheduleNext(event.target.checked)} /><span><strong>Agendar próximo contato depois de salvar</strong><span className="mt-1 block text-slate-600">O sistema abrirá o agendamento já vinculado a este contato. Você escolhe a data.</span></span></label>
          <DialogFooter><Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button><Button disabled={busy} className="bg-[#173052] text-white hover:bg-[#10233f]">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Activity className="size-4" />} {resultTaskId ? "Salvar resultado e concluir" : "Salvar no histórico"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={modal === "contactDetail"} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{detailContact?.name || "Contato"}</DialogTitle><DialogDescription>{detailContact?.title || companyById.get(detailContact?.company_id || "")?.name || "Dados e histórico do contato"}</DialogDescription></DialogHeader>
        {detailContact && <div className="space-y-5">
          {(() => { const related = pendingTasks.filter((task) => task.contact_id === detailContact.id || opportunityById.get(task.opportunity_id || "")?.contact_id === detailContact.id).sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()); const next = related[0]; return <section className="rounded-xl border border-[#d9c59d] bg-[#faf6ed] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#816736]">Próximo passo</p>{next ? <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-[#173052]">{next.title}</p><p className="text-sm text-slate-600">{formatDate(next.due_at, true)} · {next.assigned_to || "Sem responsável"}{taskIsLate(next) ? " · Atrasado" : ""}</p></div><Button size="sm" onClick={() => registerTaskResult(next.id)}>Registrar resultado</Button></div> : <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Nenhum retorno agendado para este contato.</p><Button size="sm" variant="outline" onClick={() => { setTaskForm({ ...emptyTask, contact_id: detailContact.id, title: `Retomar contato — ${detailContact.name}` }); setModal("task"); }}>Agendar retorno</Button></div>}</section>; })()}
          <div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
            <p><strong>Empresa:</strong> {companyById.get(detailContact.company_id || "")?.name || "Não informada"}</p>
            <p><strong>Responsável:</strong> {detailContact.assigned_to || "Não definido"}</p>
            <p><strong>Telefone:</strong> {detailContact.whatsapp || detailContact.phone || "Não informado"}</p>
            <p><strong>E-mail:</strong> {detailContact.email || "Não informado"}</p>
            <p><strong>Origem:</strong> {detailContact.source || "Não informada"}</p>
            <p><strong>Cadastrado:</strong> {formatDate(detailContact.created_at)}</p>
            {safeExternalUrl(detailContact.instagram) && <a href={safeExternalUrl(detailContact.instagram)!} target="_blank" rel="noopener noreferrer" className="text-[#173052] underline">Abrir Instagram</a>}
            {safeExternalUrl(detailContact.linkedin) && <a href={safeExternalUrl(detailContact.linkedin)!} target="_blank" rel="noopener noreferrer" className="text-[#173052] underline">Abrir LinkedIn</a>}
          </div>
          {detailContact.notes && <p className="text-sm leading-6 text-slate-600">{detailContact.notes}</p>}
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => editContact(detailContact)}><Pencil className="size-4" /> Editar</Button><Button variant="outline" onClick={() => { setTaskForm((current) => ({ ...current, contact_id: detailContact.id })); setModal("task"); }}><CalendarClock className="size-4" /> Follow-up</Button><Button variant="outline" onClick={() => { const now = new Date(); const end = new Date(now.getTime() + 3600000); setTaskForm({ ...emptyTask, title: `Reunião — ${detailContact.name}`, kind: "Reunião", contact_id: detailContact.id, company_id: detailContact.company_id || "", due_at: new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16), end_at: new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }); setModal("task"); }}><CalendarDays className="size-4" /> Reunião</Button><Button variant="outline" onClick={() => { setOpportunityForm({ ...emptyOpportunity, title: `Oportunidade — ${detailContact.name}`, contact_id: detailContact.id, company_id: detailContact.company_id || "" }); setModal("opportunity"); }}><Target className="size-4" /> Oportunidade</Button><Button variant="outline" onClick={() => { setInteractionForm((current) => ({ ...current, contact_id: detailContact.id })); setModal("interaction"); }}><MessageCircle className="size-4" /> Registrar interação</Button>{detailContact.company_id && <Button variant="outline" onClick={() => openDiagnostic(detailContact.company_id!,detailContact.id)}><Building2 className="size-4" /> Registrar visita</Button>}</div>
          <div><h3 className="mb-3 font-semibold text-slate-900">Conversas registradas</h3><HistoryTimeline interactions={interactions.filter((item) => item.contact_id === detailContact.id || opportunityById.get(item.opportunity_id || "")?.contact_id === detailContact.id)} /></div>
        </div>}
      </DialogContent>
    </Dialog>

    <Dialog open={modal === "opportunityDetail"} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{detailOpportunity?.title || "Oportunidade"}</DialogTitle><DialogDescription>Etapa, valor e conversas da oportunidade</DialogDescription></DialogHeader>
        {detailOpportunity && <div className="space-y-5"><div className="grid gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2"><p><strong>Etapa:</strong> {detailOpportunity.stage}</p><p><strong>Valor:</strong> {currency(detailOpportunity.amount)}</p><p><strong>Empresa:</strong> {companyById.get(detailOpportunity.company_id || "")?.name || "Não informada"}</p><p><strong>Contato:</strong> {contactById.get(detailOpportunity.contact_id || "")?.name || "Não informado"}</p><p><strong>Responsável:</strong> {detailOpportunity.assigned_to || "Não definido"}</p><p><strong>Fechamento previsto:</strong> {detailOpportunity.expected_close_at || "Não definido"}</p></div>{detailOpportunity.notes && <p className="text-sm leading-6 text-slate-600">{detailOpportunity.notes}</p>}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => editOpportunity(detailOpportunity)}><Pencil className="size-4" /> Editar</Button><Button variant="outline" onClick={() => { setTaskForm((current) => ({ ...current, opportunity_id: detailOpportunity.id })); setModal("task"); }}><CalendarClock className="size-4" /> Follow-up</Button><Button variant="outline" onClick={() => { const now = new Date(); const end = new Date(now.getTime() + 3600000); setTaskForm({ ...emptyTask, title: `Reunião — ${detailOpportunity.title}`, kind: "Reunião", opportunity_id: detailOpportunity.id, contact_id: detailOpportunity.contact_id || "", company_id: detailOpportunity.company_id || "", due_at: new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16), end_at: new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }); setModal("task"); }}><CalendarDays className="size-4" /> Reunião</Button><Button variant="outline" onClick={() => { setInteractionForm((current) => ({ ...current, opportunity_id: detailOpportunity.id })); setModal("interaction"); }}><MessageCircle className="size-4" /> Registrar interação</Button></div><div><h3 className="mb-3 font-semibold text-slate-900">Histórico de interações</h3><HistoryTimeline interactions={interactions.filter((item) => item.opportunity_id === detailOpportunity.id)} /></div></div>}
      </DialogContent>
    </Dialog>

    <Dialog open={modal === "invite"} onOpenChange={(open) => { if (!open) { setModal(null); setInviteUrl(""); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Convite para o Stormfy</DialogTitle><DialogDescription>O link funciona uma vez, expira em 7 dias e só aceita a conta {inviteEmail}.</DialogDescription></DialogHeader>
        <div className="flex gap-2"><Input readOnly value={inviteUrl} className="font-mono text-xs" /><Button type="button" className="shrink-0 bg-[#173052] text-white hover:bg-[#10233f]" onClick={copyInvite}><Copy className="size-4" /> Copiar</Button></div>
        <p className="text-xs leading-5 text-slate-500">Envie o link diretamente à pessoa convidada. O convite será consumido após a confirmação do acesso.</p>
      </DialogContent>
    </Dialog>
  </>;
}

function CrmNavigation({ activeView, setActiveView, clearSearch, lateCount }: { activeView: View; setActiveView: (view: View) => void; clearSearch: () => void; lateCount: number }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return navItems.map(({ id, label, icon: Icon }) => <SidebarMenuItem key={id}>
    <SidebarMenuButton isActive={activeView === id} onClick={() => { setActiveView(id); clearSearch(); if (isMobile) setOpenMobile(false); }} className="h-11 rounded-lg px-3 text-sm text-[#eadbb9] hover:bg-white/10 hover:text-white data-[active=true]:bg-[#a8864b] data-[active=true]:text-white">
      <Icon className="size-[18px]" /><span>{label}</span>
      {id === "tasks" && lateCount > 0 && <span className="ml-auto rounded-full bg-rose-400/20 px-2 py-0.5 text-xs font-semibold text-rose-100">{lateCount}</span>}
    </SidebarMenuButton>
  </SidebarMenuItem>);
}

function SetupRequired({ onPreview }: { onPreview?: () => void }) {
  return <main className="grid min-h-svh bg-[#f7f3ea] lg:grid-cols-[1fr_0.85fr]">
    <section className="relative hidden overflow-hidden bg-[#10233f] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#c5a56a] text-xl font-bold">S</span><span className="text-lg font-semibold tracking-tight">Stormfy</span></div>
      <div className="relative z-10 max-w-lg pb-10"><p className="text-sm font-medium uppercase tracking-[0.16em] text-[#d2ba84]">Prospecção comercial</p><h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">Clientes, negociações e próximos passos em um só lugar.</h1><p className="mt-5 max-w-md text-base leading-7 text-[#ddc99e]">Acompanhe contatos, oportunidades e follow-ups com uma visão simples da sua operação comercial.</p></div>
      <p className="text-xs text-[#d2ba84]">Stormfy · Área comercial</p>
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 top-1/4 size-[440px] rounded-full border border-[#d2ba84]/10" />
    </section>
    <section className="flex items-center justify-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-lg shadow-slate-900/[0.03] sm:p-9">
        <div className="mb-7 flex items-center gap-3 lg:hidden"><span className="grid size-10 place-items-center rounded-xl bg-[#173052] text-lg font-bold text-white">S</span><span className="font-semibold text-slate-900">Stormfy</span></div>
        <p className="text-sm font-medium text-[#173052]">Configuração do CRM</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Acesso temporariamente indisponível</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Não foi possível conectar o Stormfy à base compartilhada. A equipe deve conferir a configuração do Supabase antes de usar o CRM.</p>
        {onPreview && <><Button type="button" onClick={onPreview} className="mt-7 h-11 w-full bg-[#173052] text-white hover:bg-[#10233f]"><ChevronRight className="size-4" /> Abrir prévia local</Button><p className="mt-5 text-center text-xs leading-5 text-slate-500">A prévia salva alterações somente neste navegador.</p></>}
      </div>
    </section>
  </main>;
}

function CenteredLoading({ label }: { label: string }) {
  return <div className="grid min-h-svh place-items-center bg-[#f7f3ea]"><div className="flex items-center gap-3 text-sm text-slate-600"><LoaderCircle className="size-5 animate-spin text-[#173052]" />{label}</div></div>;
}

function AccessRestricted({ message, onRetry, onSignOut }: { message?: string; onRetry?: () => void; onSignOut: () => void }) {
  return <main className="grid min-h-svh place-items-center bg-[#f7f3ea] px-5"><div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><div className="mx-auto grid size-12 place-items-center rounded-xl bg-[#eadbb9] text-[#173052]"><Users className="size-6" /></div><h1 className="mt-5 text-xl font-semibold text-slate-900">{message ? "Não foi possível abrir o CRM" : "Acesso restrito à equipe"}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{message || "Este CRM já pertence a uma equipe. Peça ao Ismael um convite para o e-mail da sua conta."}</p><div className="mt-6 flex justify-center gap-2">{onRetry && <Button type="button" onClick={onRetry}>Tentar novamente</Button>}<Button type="button" variant="outline" onClick={onSignOut}>Sair da conta</Button></div></div></main>;
}

function AuthScreen({ mode, setMode, onSubmit, name, setName, email, setEmail, password, setPassword, message, busy, invite, allowSignup }: {
  mode: "login" | "signup" | "reset" | "updatePassword"; setMode: (mode: "login" | "signup" | "reset" | "updatePassword") => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  name: string; setName: (name: string) => void; email: string; setEmail: (email: string) => void; password: string; setPassword: (password: string) => void;
  message: string; busy: boolean; invite: boolean; allowSignup: boolean;
}) {
  return <main className="grid min-h-svh bg-[#f7f3ea] lg:grid-cols-[1fr_0.85fr]">
    <section className="relative hidden overflow-hidden bg-[#10233f] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#c5a56a] text-xl font-bold">S</span><span className="text-lg font-semibold tracking-tight">Stormfy</span></div>
      <div className="relative z-10 max-w-lg pb-10"><p className="text-sm font-medium uppercase tracking-[0.16em] text-[#d2ba84]">Relacionamento comercial</p><h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">Toda conversa começa com um próximo passo.</h1><p className="mt-5 max-w-md text-base leading-7 text-[#ddc99e]">Organize clientes, oportunidades e follow-ups em um só lugar, junto com sua equipe.</p><div className="mt-9 flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4"><span className="grid size-10 place-items-center rounded-lg bg-[#c5a56a]/20 text-[#ddc99e]"><Users className="size-5" /></span><div><p className="text-sm font-medium">Espaço compartilhado</p><p className="mt-0.5 text-sm text-[#ddc99e]">Ismael e Rudy com acesso aos mesmos clientes</p></div></div></div>
      <p className="text-xs text-[#d2ba84]">Stormfy · Acesso privado à equipe</p>
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 top-1/4 size-[440px] rounded-full border border-[#d2ba84]/10" /><div aria-hidden="true" className="pointer-events-none absolute -right-10 top-[31%] size-[290px] rounded-full border border-[#d2ba84]/10" />
    </section>
    <section className="flex items-center justify-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/[0.03] sm:p-9">
        <div className="mb-7 flex items-center gap-3 lg:hidden"><span className="grid size-10 place-items-center rounded-xl bg-[#173052] text-lg font-bold text-white">S</span><span className="font-semibold text-slate-900">Stormfy</span></div>
        {invite && <div className="mb-5 flex gap-3 rounded-lg border border-[#ddc99e] bg-[#f6f0e3] p-3 text-sm text-[#0b1a31]"><UserPlus className="mt-0.5 size-4 shrink-0" /><span>Você recebeu um convite para entrar no CRM compartilhado. Crie seu acesso para continuar.</span></div>}
        <p className="text-sm font-medium text-[#173052]">Área da equipe</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{mode === "signup" ? "Criar acesso" : mode === "reset" ? "Recuperar senha" : mode === "updatePassword" ? "Definir nova senha" : "Entre no CRM"}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{mode === "signup" ? "Crie seu usuário com e-mail e senha." : mode === "reset" ? "Enviaremos as instruções para seu e-mail, se ele estiver cadastrado." : mode === "updatePassword" ? "Escolha a nova senha para sua conta." : "Use seu e-mail e senha para acessar os clientes da equipe."}</p>
        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          {mode === "signup" && <Field label="Seu nome"><Input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome completo" autoComplete="name" /></Field>}
          {mode !== "updatePassword" && <Field label="E-mail"><Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@empresa.com" autoComplete="email" /></Field>}
          {mode !== "reset" && <Field label={mode === "updatePassword" ? "Nova senha" : "Senha"}><Input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" autoComplete={mode === "signup" || mode === "updatePassword" ? "new-password" : "current-password"} /></Field>}
          {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm leading-5 text-emerald-800">{message}</p>}
          <Button disabled={busy} className="h-11 w-full bg-[#173052] text-white hover:bg-[#10233f]">{busy ? <LoaderCircle className="size-4 animate-spin" /> : mode === "reset" ? <Mail className="size-4" /> : <ChevronRight className="size-4" />}{mode === "signup" ? "Criar acesso" : mode === "reset" ? "Enviar instruções" : mode === "updatePassword" ? "Salvar nova senha" : "Entrar"}</Button>
        </form>
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 text-sm">
          {mode === "login" && <><button type="button" onClick={() => setMode("reset")} className="text-left text-slate-500 hover:text-[#173052]">Esqueci minha senha</button>{(invite || allowSignup) && <p className="text-slate-500">Ainda não tem acesso? <button type="button" onClick={() => setMode("signup")} className="font-medium text-[#173052] hover:text-[#0b1a31]">Criar uma conta</button></p>}</>}
          {mode !== "login" && mode !== "updatePassword" && <p className="text-slate-500">Já tem acesso? <button type="button" onClick={() => setMode("login")} className="font-medium text-[#173052] hover:text-[#0b1a31]">Voltar para entrar</button></p>}
        </div>
        <p className="mt-6 text-xs leading-5 text-slate-400">Os dados do CRM são privados e só ficam disponíveis para membros da equipe autorizados.</p>
      </div>
    </section>
  </main>;
}

function WorkspaceSetup({ userName, workspaceName, setWorkspaceName, onSubmit, busy }: { userName: string; workspaceName: string; setWorkspaceName: (name: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  return <main className="grid min-h-svh place-items-center bg-[#f7f3ea] px-5 py-10"><div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/[0.04] sm:p-9"><div className="grid size-12 place-items-center rounded-xl bg-[#173052] text-xl font-bold text-white">S</div><p className="mt-6 text-sm font-medium text-[#173052]">Primeiro acesso</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Crie o espaço da equipe</h1><p className="mt-2 text-sm leading-6 text-slate-500">Olá, {userName}. Dê um nome ao CRM. Depois, você poderá gerar um convite para o Rudy. Os dois terão acesso completo aos registros compartilhados.</p><form onSubmit={onSubmit} className="mt-6 space-y-4"><Field label="Nome do espaço"><Input required maxLength={80} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} /></Field><Button disabled={busy} className="h-11 w-full bg-[#173052] text-white hover:bg-[#10233f]">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Building2 className="size-4" />} Criar CRM compartilhado</Button></form></div></main>;
}
