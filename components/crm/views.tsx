"use client";

import { useState } from "react";
import { Activity, Archive, BadgeCheck, BarChart3, Building2, CalendarClock, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, ExternalLink, FilePenLine, LoaderCircle, MessageCircle, Pencil, Plus, Target, Trash2, UserPlus, Users } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/crm/field";
import { stages, type BoardActivity, type Company, type CompanyDiagnostic, type Contact, type Interaction, type Opportunity, type Task, type View, type Workspace } from "@/lib/crm-types";
import { currency, formatDate, initials, labelForTask, taskIsLate } from "@/lib/crm-utils";

function MetricCard({ label, value, detail, icon: Icon, tone = "violet", onClick }: { label: string; value: string | number; detail: string; icon: typeof Users; tone?: "violet" | "blue" | "amber" | "green" | "rose"; onClick: () => void }) {
  const tones = {
    violet: "bg-[#f6f0e3] text-[#173052]",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return <button type="button" onClick={onClick} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm shadow-slate-900/[0.02] transition hover:border-[#d2ba84] focus-visible:outline-2 focus-visible:outline-[#a8864b]">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p></div>
      <span className={`grid size-10 place-items-center rounded-lg ${tones[tone]}`}><Icon className="size-5" /></span>
    </div>
    <p className="mt-3 text-sm text-slate-500">{detail}</p>
  </button>;
}

type DashboardPeriod = "today" | "7d" | "30d" | "all";

function inDashboardPeriod(value: string, period: DashboardPeriod) {
  if (period === "all") return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period === "7d") start.setDate(start.getDate() - 6);
  if (period === "30d") start.setDate(start.getDate() - 29);
  return date.getTime() >= start.getTime();
}

function commercialTrend(opportunities: Opportunity[], period: DashboardPeriod) {
  const now = new Date();
  const buckets: { label: string; start: Date; end: Date }[] = [];
  if (period === "today") {
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    for (let hour = 0; hour < 24; hour += 4) {
      const bucketStart = new Date(start); bucketStart.setHours(hour);
      const bucketEnd = new Date(start); bucketEnd.setHours(hour + 4);
      buckets.push({ label: `${String(hour).padStart(2, "0")}h`, start: bucketStart, end: bucketEnd });
    }
  } else if (period === "7d") {
    for (let offset = 6; offset >= 0; offset -= 1) {
      const start = new Date(now); start.setDate(start.getDate() - offset); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      buckets.push({ label: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), start, end });
    }
  } else if (period === "30d") {
    for (let offset = 25; offset >= 0; offset -= 5) {
      const start = new Date(now); start.setDate(start.getDate() - offset); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 5);
      buckets.push({ label: start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), start, end });
    }
  } else {
    const validDates = opportunities.map((item) => new Date(item.created_at)).filter((date) => !Number.isNaN(date.getTime()));
    const first = validDates.length ? new Date(Math.min(...validDates.map((date) => date.getTime()))) : new Date(now);
    const startMonth = new Date(first.getFullYear(), first.getMonth(), 1);
    const totalMonths = Math.max(1, (now.getFullYear() - startMonth.getFullYear()) * 12 + now.getMonth() - startMonth.getMonth() + 1);
    const bucketMonths = Math.max(1, Math.ceil(totalMonths / 6));
    for (let cursor = new Date(startMonth); cursor <= now; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + bucketMonths, 1)) {
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + bucketMonths, 1);
      buckets.push({ label: cursor.toLocaleDateString("pt-BR", { month: "short", year: totalMonths > 12 ? "2-digit" : undefined }), start: new Date(cursor), end });
    }
  }
  return buckets.slice(-7).map((bucket) => {
    const items = opportunities.filter((item) => { const date = new Date(item.created_at); return date >= bucket.start && date < bucket.end; });
    return { periodo: bucket.label.replace(".", ""), criadas: items.length, ganhas: items.filter((item) => item.stage === "Ganho").length, valor: items.reduce((sum, item) => sum + Number(item.amount || 0), 0) };
  });
}

export function DashboardView({ contacts, companies, opportunities, tasks, interactions, activities, diagnostics, onView, onCreateTask, onCreateMeeting, onCreateActivity, onCreateCompany, onCreateDiagnostic, onCompanyDetail, onCompleteTask, onCreateOpportunity, onCreateContact, onCreateInteraction, onContactDetail, onOpportunityDetail, onOpenStage }: {
  contacts: Contact[]; companies: Company[]; opportunities: Opportunity[]; tasks: Task[]; interactions: Interaction[]; activities: BoardActivity[]; diagnostics: CompanyDiagnostic[];
  onView: (view: View) => void; onCreateTask: () => void; onCompleteTask: (id: string) => void; onCreateOpportunity: () => void; onCreateContact: () => void;
  onCreateCompany: () => void; onCreateMeeting: () => void; onCreateActivity: () => void; onCreateDiagnostic: () => void; onCompanyDetail: (id: string) => void;
  onCreateInteraction: () => void; onContactDetail: (id: string) => void; onOpportunityDetail: (id: string) => void; onOpenStage: (stage: string) => void;
}) {
  const [period, setPeriod] = useState<DashboardPeriod>("all");
  const [responsible, setResponsible] = useState("all");
  const [showAllContacts, setShowAllContacts] = useState(false);
  const companyMap = new Map(companies.map((company) => [company.id, company]));
  const contactMap = new Map(contacts.map((contact) => [contact.id, contact]));
  const opportunityMap = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));
  const assignees = [...new Set([
    "Ismael Charello",
    "Rudy Mendonça",
    ...[...contacts, ...opportunities, ...tasks, ...activities]
      .map((item) => item.assigned_to?.trim())
      .filter((value): value is string => Boolean(value)),
  ])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const matchesResponsible = (value?: string | null) => responsible === "all" || (responsible === "__unassigned" ? !value : value === responsible);
  const interactionResponsible = (interaction: Interaction) => opportunityMap.get(interaction.opportunity_id || "")?.assigned_to || contactMap.get(interaction.contact_id || "")?.assigned_to || null;
  const filteredContacts = contacts.filter((item) => !item.archived_at && inDashboardPeriod(item.created_at, period) && matchesResponsible(item.assigned_to));
  const filteredOpportunities = opportunities.filter((item) => inDashboardPeriod(item.created_at, period) && matchesResponsible(item.assigned_to));
  const filteredTasks = tasks.filter((item) => inDashboardPeriod(item.due_at, period) && matchesResponsible(item.assigned_to));
  const filteredInteractions = interactions.filter((item) => inDashboardPeriod(item.occurred_at, period) && matchesResponsible(interactionResponsible(item)));
  const currentContacts = contacts.filter((item) => !item.archived_at && matchesResponsible(item.assigned_to));
  const currentOpenOpportunities = opportunities.filter((item) => !item.is_draft && item.stage !== "Ganho" && item.stage !== "Perdido" && matchesResponsible(item.assigned_to));
  const currentPendingTasks = tasks.filter((item) => item.status === "Pendente" && matchesResponsible(item.assigned_to));
  const currentLateTasks = currentPendingTasks.filter(taskIsLate);
  const pendingTasks = filteredTasks.filter((item) => item.status === "Pendente");
  const todayTasks = tasks.filter((item) => item.status === "Pendente" && new Date(item.due_at).toDateString() === new Date().toDateString() && matchesResponsible(item.assigned_to));
  const upcomingMeetings = tasks.filter((item) => item.kind === "Reunião" && item.status === "Pendente" && item.meeting_status !== "Rascunho" && item.meeting_status !== "Cancelada" && new Date(item.due_at) >= new Date() && matchesResponsible(item.assigned_to)).sort((a,b) => new Date(a.due_at).getTime()-new Date(b.due_at).getTime());
  const activeTasks = [...pendingTasks].sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()).slice(0, 6);
  const filteredCompanyIds = new Set((responsible === "all" ? contacts : contacts.filter((item) => matchesResponsible(item.assigned_to))).map((item) => item.company_id).filter(Boolean));
  const visibleCompanies = (responsible === "all" ? companies : companies.filter((item) => filteredCompanyIds.has(item.id))).filter((item) => !item.archived_at);
  const stagesSummary = stages.map((stage) => {
    const items = filteredOpportunities.filter((item) => !item.is_draft && item.stage === stage);
    return { stage, count: items.length, amount: items.reduce((sum, item) => sum + Number(item.amount || 0), 0) };
  });
  const periodLabel = { today: "Hoje", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", all: "Todo o período" }[period];
  const responsibleLabel = responsible === "all" ? "Toda a equipe" : responsible === "__unassigned" ? "Sem responsável" : responsible;
  const hasAnyData = contacts.length + companies.length + opportunities.length + tasks.length + interactions.length > 0;
  const hasFilteredData = filteredContacts.length + filteredOpportunities.length + filteredTasks.length + filteredInteractions.length > 0;
  const trend = commercialTrend(filteredOpportunities.filter((item) => !item.is_draft), period);
  const completedDiagnostics = diagnostics.filter((item) => item.status === "completed" && matchesResponsible(item.responsible));
  const periodDiagnostics = completedDiagnostics.filter((item) => inDashboardPeriod(item.visit_at, period));
  const visitedIds = new Set(completedDiagnostics.map((item) => item.company_id));
  const diagnosisFor = (companyId: string) => completedDiagnostics.filter((item) => item.company_id === companyId)
    .sort((a,b) => new Date(b.visit_at).getTime() - new Date(a.visit_at).getTime())[0];
  const attentionReason = (company: Company) => {
    const diagnosis = diagnosisFor(company.id);
    if (!diagnosis) return null;
    const pending = tasks.filter((item) => item.status === "Pendente" && !item.archived_at &&
      (item.company_id === company.id || contacts.some((c) => c.company_id === company.id && c.id === item.contact_id)));
    if (pending.some(taskIsLate)) return "Follow-up atrasado";
    if (!pending.length) return "Sem retorno agendado";
    const openDeal = opportunities.find((item) => item.company_id === company.id && !item.is_draft && !["Ganho","Perdido"].includes(item.stage) &&
      !tasks.some((task) => task.status === "Pendente" && task.opportunity_id === item.id));
    if (openDeal) return "Oportunidade sem tarefa vinculada";
    if (diagnosis.potential === "Alto" && !pending.some((item) => item.kind === "Reunião" && item.meeting_status === "Agendada")) return "Potencial alto sem reunião marcada";
    if (inDashboardPeriod(diagnosis.visit_at,"7d")) return "Visita recente";
    return null;
  };
  const attentionCompanies = companies.filter((company) => Boolean(attentionReason(company)))
    .sort((a,b) => new Date(diagnosisFor(b.id).visit_at).getTime() - new Date(diagnosisFor(a.id).visit_at).getTime());
  const summaryAssignees = [...assignees, "__unassigned"].map((name) => {
    const assigned = (value?: string | null) => name === "__unassigned" ? !value : value === name;
    const ownerContacts = contacts.filter((item) => assigned(item.assigned_to));
    const ownerOpportunities = opportunities.filter((item) => !item.is_draft && assigned(item.assigned_to) && item.stage !== "Ganho" && item.stage !== "Perdido");
    const ownerTasks = tasks.filter((item) => assigned(item.assigned_to) && item.status === "Pendente");
    const ownerMeetings = tasks.filter((item) => assigned(item.assigned_to) && item.kind === "Reunião" && item.status === "Pendente" && item.meeting_status === "Agendada");
    const ownerActivities = activities.filter((item) => assigned(item.assigned_to) && item.status === "published");
    return { name, contacts: ownerContacts.length, opportunities: ownerOpportunities.length, amount: ownerOpportunities.reduce((sum, item) => sum + Number(item.amount || 0), 0), tasks: ownerTasks.length, meetings: ownerMeetings.length, activities: ownerActivities.length };
  });

  return <div className="space-y-6">
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <Field label="Período"><NativeSelect value={period} onChange={(event) => setPeriod(event.target.value as DashboardPeriod)}><option value="today">Hoje</option><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="all">Todo o período</option></NativeSelect></Field>
        <Field label="Responsável"><NativeSelect value={responsible} onChange={(event) => setResponsible(event.target.value)}><option value="all">Todos</option>{assignees.map((name) => <option key={name} value={name}>{name}</option>)}<option value="__unassigned">Sem responsável</option></NativeSelect></Field>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ações rápidas</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8 [&>button]:min-w-0 [&>button]:justify-start [&>button]:px-3"><Button variant="outline" onClick={onCreateContact}><Users className="size-4 shrink-0 text-[#173052]" /><span className="truncate">Novo contato</span></Button><Button variant="outline" onClick={onCreateCompany}><Building2 className="size-4 shrink-0 text-[#173052]" /><span className="truncate">Nova empresa</span></Button><Button variant="outline" onClick={onCreateOpportunity}><Target className="size-4 shrink-0 text-[#173052]" /><span className="truncate">Nova oportunidade</span></Button><Button variant="outline" onClick={onCreateMeeting}><CalendarDays className="size-4 shrink-0 text-[#173052]" /><span className="truncate">Reunião</span></Button><Button variant="outline" onClick={onCreateTask}><CalendarClock className="size-4 shrink-0 text-[#173052]" /><span className="truncate">Follow-up</span></Button><Button variant="outline" onClick={onCreateActivity}><Activity className="size-4 shrink-0 text-[#173052]" /><span className="truncate">Nova atividade</span></Button><Button variant="outline" onClick={onCreateDiagnostic}><FilePenLine className="size-4 shrink-0 text-[#173052]" /><span className="truncate">Registrar visita</span></Button><Button className="bg-[#173052] text-white hover:bg-[#10233f]" onClick={onCreateInteraction}><Activity className="size-4 shrink-0" /><span className="truncate">Interação</span></Button></div>
      </div>
    </section>

    {!hasAnyData ? <section className="rounded-xl border border-slate-200 bg-white"><EmptyState icon={Target} title="Comece sua operação comercial" detail="Cadastre um contato ou uma oportunidade para acompanhar o funil e os próximos passos." action="Novo contato" onClick={onCreateContact} /></section> : !hasFilteredData && period !== "all" ? <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="font-semibold text-slate-900">Nenhum resultado neste período</h2><p className="mt-2 text-sm text-slate-500">Ajuste o período ou o responsável para visualizar outros registros.</p><Button variant="outline" className="mt-4" onClick={() => { setPeriod("all"); setResponsible("all"); }}>Limpar filtros</Button></section> : null}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Contatos ativos" value={currentContacts.length} detail={`Total atual · ${responsibleLabel}`} icon={Users} tone="violet" onClick={() => onView("contacts")} />
      <MetricCard label="Empresas ativas" value={visibleCompanies.length} detail={responsible === "all" ? "Total atual da carteira" : `Relacionadas a ${responsibleLabel}`} icon={Building2} tone="blue" onClick={() => onView("companies")} />
      <MetricCard label="Oportunidades abertas" value={currentOpenOpportunities.length} detail={`Total atual · ${responsibleLabel}`} icon={Target} tone="blue" onClick={() => onView("pipeline")} />
      <MetricCard label="Valor do funil" value={currency(currentOpenOpportunities.reduce((sum, item) => sum + Number(item.amount || 0), 0))} detail="Total atual das oportunidades abertas" icon={Target} tone="green" onClick={() => onView("pipeline")} />
      <MetricCard label="Follow-ups pendentes" value={currentPendingTasks.length} detail={`Total atual · ${responsibleLabel}`} icon={CalendarClock} tone="violet" onClick={() => onView("tasks")} />
      <MetricCard label="Tarefas atrasadas" value={currentLateTasks.length} detail={currentLateTasks.length ? "Total atual · precisam de atenção" : "Total atual · nenhuma tarefa vencida"} icon={Clock3} tone={currentLateTasks.length ? "rose" : "green"} onClick={() => onView("tasks")} />
      <MetricCard label="Atividades previstas para hoje" value={todayTasks.length} detail={`${responsibleLabel} · total atual`} icon={CalendarClock} tone="amber" onClick={() => onView("tasks")} />
      <MetricCard label="Reuniões agendadas" value={upcomingMeetings.length} detail="Próximas reuniões confirmadas" icon={CalendarDays} tone="blue" onClick={() => onView("calendar")} />
    </div>

    <section className="space-y-3"><div><h2 className="font-semibold text-[#173052]">Visitas e diagnósticos</h2><p className="text-sm text-slate-600">Registros concluídos no período · {periodLabel.toLowerCase()}</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Empresas visitadas" value={new Set(periodDiagnostics.map((item) => item.company_id)).size} detail="No período selecionado" icon={Building2} onClick={() => onView("companies")} />
        <MetricCard label="Diagnósticos realizados" value={periodDiagnostics.length} detail="No período selecionado" icon={FilePenLine} onClick={() => onView("companies")} />
        <MetricCard label="Oportunidades identificadas" value={periodDiagnostics.reduce((total,item) => total + item.ideas.length,0)} detail="Ideias registradas nas visitas" icon={Target} onClick={() => onView("companies")} />
        <MetricCard label="Potencial alto" value={periodDiagnostics.filter((item) => item.potential === "Alto").length} detail="Diagnósticos no período" icon={BadgeCheck} onClick={() => onView("companies")} />
        <MetricCard label="Visitas presenciais" value={periodDiagnostics.filter((item) => item.visit_kind === "Visita presencial").length} detail="No período selecionado" icon={Users} onClick={() => onView("companies")} />
        <MetricCard label="Sem próximo follow-up" value={attentionCompanies.filter((company) => !tasks.some((task) => task.status === "Pendente" && (task.company_id === company.id || contacts.some((c) => c.company_id === company.id && c.id === task.contact_id)))).length} detail="Empresas já visitadas · total atual" icon={CalendarClock} tone="amber" onClick={() => onView("companies")} />
        <MetricCard label="Follow-ups atrasados" value={currentLateTasks.length} detail="Total atual" icon={Clock3} tone="rose" onClick={() => onView("tasks")} />
        <MetricCard label="Empresas com diagnóstico" value={visitedIds.size} detail="Total atual" icon={Check} onClick={() => onView("companies")} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-[#173052]">Empresas que precisam de atenção</h3>{attentionCompanies.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{attentionCompanies.slice(0,9).map((company) => <button type="button" key={company.id} onClick={() => onCompanyDetail(company.id)} className="rounded-lg border border-[#eadbb9] bg-[#fffdfa] p-3 text-left hover:border-[#a8864b]"><strong className="text-sm text-[#173052]">{company.name}</strong><p className="mt-1 text-sm text-slate-600">{attentionReason(company)}</p></button>)}</div> : <p className="mt-2 text-sm text-slate-600">Nenhuma empresa visitada precisa de ação neste momento.</p>}</div>
      {periodDiagnostics.length > 0 && <div className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-[#173052]">Diagnósticos por responsável</h3><div className="mt-3 flex flex-wrap gap-2">{[...new Set(periodDiagnostics.map((item) => item.responsible || "Sem responsável"))].map((name) => <Badge key={name} variant="secondary" className="p-2 text-sm">{name}: {periodDiagnostics.filter((item) => (item.responsible || "Sem responsável") === name).length}</Badge>)}</div></div>}
    </section>

    <section className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Evolução comercial</h2><p className="mt-1 text-sm text-slate-500">Oportunidades criadas, ganhas e valor estimado · {periodLabel.toLowerCase()}</p></div>
      {filteredOpportunities.filter((item) => !item.is_draft).length === 0 ? <EmptyState icon={BarChart3} title="Sem dados comerciais neste filtro" detail="O gráfico será preenchido quando houver oportunidades publicadas no período selecionado." action="Nova oportunidade" onClick={onCreateOpportunity} /> : <div className="h-[310px] w-full p-4 sm:p-5" role="img" aria-label="Gráfico de evolução comercial com oportunidades criadas, ganhas e valor estimado"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" /><XAxis dataKey="periodo" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis yAxisId="count" allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis yAxisId="amount" orientation="right" tickFormatter={(value) => `R$ ${Number(value) >= 1000 ? `${Math.round(Number(value) / 1000)}k` : Number(value)}`} tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ borderRadius: 10, borderColor: "#ded8cb", boxShadow: "0 10px 30px rgba(16,35,63,.08)" }} formatter={(value, name) => [name === "Valor estimado" ? currency(Number(value)) : Number(value), name]} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar yAxisId="count" dataKey="criadas" name="Criadas" fill="#173052" radius={[5,5,0,0]} /><Bar yAxisId="count" dataKey="ganhas" name="Ganhas" fill="#c6a96b" radius={[5,5,0,0]} /><Line yAxisId="amount" type="monotone" dataKey="valor" name="Valor estimado" stroke="#315477" strokeWidth={2.5} dot={{ r: 3, fill: "#315477" }} /></ComposedChart></ResponsiveContainer></div>}
    </section>

    <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Próximas reuniões</h2><Button variant="ghost" onClick={() => onView("calendar")}>Abrir calendário <ChevronRight className="size-4" /></Button></div>{upcomingMeetings.length ? <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{upcomingMeetings.slice(0,6).map((meeting) => <button key={meeting.id} type="button" onClick={() => onView("calendar")} className="rounded-lg border border-[#eadbb9] bg-[#fffdfa] p-4 text-left hover:border-[#a8864b]"><p className="font-medium text-[#10233f]">{meeting.title}</p><p className="mt-2 text-sm text-slate-600">{formatDate(meeting.due_at,true)} · {meeting.assigned_to || "Sem responsável"}</p><p className="mt-1 text-sm text-slate-500">{meeting.location || contacts.find((x) => x.id === meeting.contact_id)?.name || "Local a definir"}</p></button>)}</div> : <p className="p-5 text-sm text-slate-500">Nenhuma reunião futura agendada.</p>}</section>

    <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Funil de oportunidades</h2><p className="mt-1 text-sm text-slate-500">Quantidade e valor por etapa · {periodLabel.toLowerCase()}</p></div><Button variant="ghost" className="text-sm text-[#173052] hover:text-[#0b1a31]" onClick={() => onView("pipeline")}>Abrir funil <ChevronRight className="size-4" /></Button></div>
        {filteredOpportunities.filter((item) => !item.is_draft).length === 0 ? <EmptyState icon={Target} title="Nenhuma oportunidade publicada no filtro" detail="Cadastre uma oportunidade, publique um rascunho ou amplie o período selecionado." action="Nova oportunidade" onClick={onCreateOpportunity} /> : <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">{stagesSummary.map(({ stage, count, amount }) => { const finalStage = stage === "Ganho" || stage === "Perdido"; return <button type="button" key={stage} onClick={() => onOpenStage(stage)} className={`rounded-lg border p-4 text-left transition hover:border-[#d2ba84] focus-visible:outline-2 focus-visible:outline-[#a8864b] ${stage === "Ganho" ? "border-emerald-200 bg-emerald-50/60" : stage === "Perdido" ? "border-slate-200 bg-slate-100" : "border-slate-100 bg-slate-50/70"}`}><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-slate-700">{stage}</span><Badge variant="secondary" className={finalStage ? "bg-white/80" : "bg-white text-slate-600"}>{count}</Badge></div><p className="mt-3 text-sm font-semibold text-slate-900">{currency(amount)}</p><p className="mt-1 text-xs text-slate-500">{count} oportunidade{count === 1 ? "" : "s"}</p></button>; })}</div>}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Próximos follow-ups</h2><p className="mt-1 text-sm text-slate-500">Atrasados primeiro, depois os próximos</p></div><Button variant="ghost" size="icon" aria-label="Agendar follow-up" onClick={onCreateTask}><Plus className="size-4 text-[#173052]" /></Button></div>
        {activeTasks.length === 0 ? <EmptyState icon={CalendarClock} title="Nenhum follow-up no filtro" detail="Agende o próximo contato ou amplie o período selecionado." action="Agendar follow-up" onClick={onCreateTask} /> : <div className="divide-y divide-slate-100">{activeTasks.map((task) => { const contact = contactMap.get(task.contact_id || ""); const opportunity = opportunityMap.get(task.opportunity_id || ""); const company = companyMap.get(task.company_id || ""); const late = taskIsLate(task); return <div key={task.id} className="flex flex-wrap items-start gap-3 px-5 py-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-slate-800">{task.title}</p><Badge variant="secondary" className={late ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}>{late ? "Atrasada" : task.priority}</Badge></div>{(opportunity || contact || company) && <button type="button" onClick={() => opportunity ? onOpportunityDetail(opportunity.id) : contact ? onContactDetail(contact.id) : company && onCompanyDetail(company.id)} className="mt-1 text-left text-sm text-[#173052] hover:underline">{opportunity?.title || contact?.name || company?.name}</button>}<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span className={late ? "font-semibold text-rose-700" : ""}>{formatDate(task.due_at, true)}</span><span>{task.assigned_to || "Sem responsável"}</span><span>{task.kind}</span></div></div><Button size="sm" variant="outline" onClick={() => onCompleteTask(task.id)}>{!task.contact_id && !task.opportunity_id ? "Concluir" : "Registrar resultado"}</Button></div>; })}</div>}
      </section>
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Contatos recentes</h2><p className="mt-1 text-sm text-slate-500">{showAllContacts ? `Mostrando todos os ${filteredContacts.length} contatos do filtro` : `Mostrando até 6 de ${filteredContacts.length} contatos do filtro`}</p></div><div className="flex flex-wrap items-center gap-1">{filteredContacts.length > 6 && <Button variant="ghost" className="text-sm text-[#173052]" onClick={() => setShowAllContacts((current) => !current)}>{showAllContacts ? "Mostrar recentes" : `Ver todos (${filteredContacts.length})`}</Button>}<Button variant="ghost" className="text-sm text-[#173052]" onClick={() => onView("contacts")}>Abrir carteira <ChevronRight className="size-4" /></Button></div></div>
        {filteredContacts.length === 0 ? <EmptyState icon={Users} title="Nenhum contato no filtro" detail="Adicione uma pessoa ou amplie o período selecionado." action="Novo contato" onClick={onCreateContact} /> : <div className={`divide-y divide-slate-100 ${showAllContacts ? "max-h-[640px] overflow-y-auto" : ""}`}>{filteredContacts.slice(0, showAllContacts ? filteredContacts.length : 6).map((contact) => <button type="button" key={contact.id} onClick={() => onContactDetail(contact.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#a8864b]"><Avatar className="size-9"><AvatarFallback className="bg-[#f6f0e3] text-xs font-semibold text-[#173052]">{initials(contact.name)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-800">{contact.name}</p><p className="truncate text-xs text-slate-500">{companyMap.get(contact.company_id || "")?.name || "Empresa não informada"} · {contact.assigned_to || "Sem responsável"}</p></div><span className="hidden text-xs text-slate-400 sm:block">{formatDate(contact.created_at)}</span></button>)}</div>}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Atividades recentes</h2><p className="mt-1 text-sm text-slate-500">Conversas e reuniões registradas</p></div><Button variant="ghost" size="icon" aria-label="Registrar interação" onClick={onCreateInteraction}><Plus className="size-4 text-[#173052]" /></Button></div>
        {filteredInteractions.length === 0 ? <EmptyState icon={Activity} title="Nenhuma atividade no filtro" detail="Registre uma conversa ou amplie o período selecionado." action="Registrar interação" onClick={onCreateInteraction} /> : <div className="divide-y divide-slate-100">{filteredInteractions.slice(0, 6).map((interaction) => { const contact = contactMap.get(interaction.contact_id || ""); const opportunity = opportunityMap.get(interaction.opportunity_id || ""); const assigned = interactionResponsible(interaction); return <button type="button" key={interaction.id} onClick={() => opportunity ? onOpportunityDetail(opportunity.id) : contact && onContactDetail(contact.id)} className="flex w-full gap-3 px-5 py-3.5 text-left hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#a8864b]"><span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[#f6f0e3] text-[#173052]"><MessageCircle className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-slate-800">{interaction.kind} · {contact?.name || opportunity?.title || "CRM"}</p><span className="text-xs text-slate-400">{formatDate(interaction.occurred_at, true)}</span></div><p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{interaction.summary}</p><p className="mt-1 text-xs text-slate-400">{assigned || "Sem responsável"}</p></div></button>; })}</div>}
      </section>
    </div>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.02]">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Resumo por responsável</h2><p className="mt-1 text-sm text-slate-500">Carteira atual da equipe</p></div>
      {summaryAssignees.length === 0 ? <p className="p-5 text-sm text-slate-500">Ainda não há registros atribuídos a responsáveis.</p> : <><div className="divide-y divide-slate-100 md:hidden">{summaryAssignees.map((item) => <div key={item.name} className="p-4"><p className="font-medium text-slate-900">{item.name === "__unassigned" ? "Sem responsável" : item.name}</p><div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-600"><span>{item.contacts} contatos</span><span>{item.opportunities} oportunidades</span><span>{currency(item.amount)}</span><span>{item.tasks} follow-ups</span><span>{item.meetings} reuniões</span><span>{item.activities} atividades</span></div></div>)}</div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-medium">Responsável</th><th className="px-5 py-3 font-medium">Contatos</th><th className="px-5 py-3 font-medium">Oportunidades abertas</th><th className="px-5 py-3 font-medium">Valor do funil</th><th className="px-5 py-3 font-medium">Follow-ups</th><th className="px-5 py-3 font-medium">Reuniões</th><th className="px-5 py-3 font-medium">Atividades</th></tr></thead><tbody className="divide-y divide-slate-100">{summaryAssignees.map((item) => <tr key={item.name}><td className="px-5 py-3 font-medium text-slate-900">{item.name === "__unassigned" ? "Sem responsável" : item.name}</td><td className="px-5 py-3 text-slate-600">{item.contacts}</td><td className="px-5 py-3 text-slate-600">{item.opportunities}</td><td className="px-5 py-3 font-medium text-slate-800">{currency(item.amount)}</td><td className="px-5 py-3 text-slate-600">{item.tasks}</td><td className="px-5 py-3 text-slate-600">{item.meetings}</td><td className="px-5 py-3 text-slate-600">{item.activities}</td></tr>)}</tbody></table></div></>}
    </section>
  </div>;
}

export function ContactsView({ contacts, companies, diagnostics, tasks, canEdit, initialTab = "people", companyFilter, setCompanyFilter, sourceFilter, setSourceFilter, sources, onCreate, onCreateCompany, onEditCompany, onArchiveCompany, onRestoreCompany, onEdit, onArchive, onDetail, onCompanyDetail, onRegisterVisit, onContactVisit, onWhatsApp, onImport, importing, onAddInteraction, onAddTask }: {
  contacts: Contact[]; companies: Company[]; diagnostics: CompanyDiagnostic[]; tasks: Task[]; canEdit: boolean; companyFilter: string; setCompanyFilter: (value: string) => void;
  initialTab?: "people" | "companies";
  sourceFilter: string; setSourceFilter: (value: string) => void; sources: string[];
  onCreate: () => void; onCreateCompany: () => void; onEditCompany: (company: Company) => void;
  onArchiveCompany: (company: Company) => void; onRestoreCompany: (company: Company) => void;
  onEdit: (contact: Contact) => void; onArchive: (contact: Contact) => void; onDetail: (id: string) => void;
  onCompanyDetail: (id: string) => void; onRegisterVisit: (companyId?: string) => void; onContactVisit: (companyId: string, contactId: string) => void;
  onWhatsApp: (phone?: string | null) => void; onImport: () => void; importing: boolean;
  onAddInteraction: (id: string) => void; onAddTask: (id: string) => void;
}) {
  const [tab, setTab] = useState<"people" | "companies">(initialTab);
  const [diagnosticFilter, setDiagnosticFilter] = useState("all");
  const [relationshipFilter, setRelationshipFilter] = useState("");
  const [potentialFilter, setPotentialFilter] = useState("");
  const [diagnosticOwnerFilter, setDiagnosticOwnerFilter] = useState("");
  const companyMap = new Map(companies.map((item) => [item.id, item]));
  const latestDiagnosis = (id: string) => diagnostics.filter((item) => item.company_id === id && item.status === "completed")
    .sort((a,b) => new Date(b.visit_at).getTime() - new Date(a.visit_at).getTime())[0];
  const nextTask = (id: string) => tasks.filter((item) => item.status === "Pendente" && !item.archived_at && (item.company_id === id || contacts.some((contact) => contact.id === item.contact_id && contact.company_id === id)))
    .sort((a,b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0];
  const shownCompanies = companies.filter((company) => {
    const diagnosis = latestDiagnosis(company.id); const task = nextTask(company.id);
    if (relationshipFilter && diagnosis?.relationship_status !== relationshipFilter) return false;
    if (potentialFilter && diagnosis?.potential !== potentialFilter) return false;
    if (diagnosticOwnerFilter && (diagnosis?.responsible || "__none") !== diagnosticOwnerFilter) return false;
    if (diagnosticFilter === "completed") return Boolean(diagnosis);
    if (diagnosticFilter === "missing") return !diagnosis;
    if (diagnosticFilter === "late") return Boolean(task && taskIsLate(task));
    if (diagnosticFilter === "no-next") return Boolean(diagnosis && !task);
    if (diagnosticFilter === "visited") return Boolean(diagnosis);
    if (diagnosticFilter === "opportunity") return Boolean(diagnosis?.ideas.length);
    if (diagnosticFilter === "high") return diagnosis?.potential === "Alto";
    return true;
  });
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div><h2 className="font-semibold text-slate-900">Carteira de clientes</h2><p className="mt-1 text-sm text-slate-500">Pessoas, empresas e próximos passos da prospecção</p></div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={importing} onClick={onImport}>{importing ? <LoaderCircle className="size-4 animate-spin" /> : <Users className="size-4" />} Importar contatos iniciais</Button>
        {tab === "companies" && canEdit && <Button type="button" variant="outline" onClick={() => onRegisterVisit()}><FilePenLine className="size-4" /> Registrar visita</Button>}
        <Button type="button" className="bg-[#173052] text-white hover:bg-[#10233f]" onClick={tab === "people" ? onCreate : onCreateCompany}><Plus className="size-4" /> {tab === "people" ? "Novo contato" : "Nova empresa"}</Button>
      </div>
    </div>
    <div className="flex gap-4 border-b border-slate-100 px-5" role="tablist" aria-label="Tipo de registro">
      <button role="tab" aria-selected={tab === "people"} className={`border-b-2 py-3 text-sm font-medium ${tab === "people" ? "border-[#173052] text-[#10233f]" : "border-transparent text-slate-500"}`} onClick={() => setTab("people")}>Contatos ({contacts.length})</button>
      <button role="tab" aria-selected={tab === "companies"} className={`border-b-2 py-3 text-sm font-medium ${tab === "companies" ? "border-[#173052] text-[#10233f]" : "border-transparent text-slate-500"}`} onClick={() => setTab("companies")}>Empresas ({companies.filter((item) => !item.archived_at).length})</button>
    </div>
    {tab === "people" ? <>
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 sm:px-5">
        <Field label="Filtrar por empresa"><NativeSelect value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}><option value="">Todas as empresas</option>{companies.filter((item) => !item.archived_at || item.id === companyFilter).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</NativeSelect></Field>
        <Field label="Filtrar por origem"><NativeSelect value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="">Todas as origens</option>{sources.map((source) => <option key={source}>{source}</option>)}</NativeSelect></Field>
      </div>
      {contacts.length === 0 ? <EmptyState icon={Users} title="Nenhum contato encontrado" detail="Cadastre uma pessoa ou limpe os filtros para ver a carteira." action="Novo contato" onClick={onCreate} /> : <>
        <div className="divide-y divide-slate-100 md:hidden">{contacts.map((item) => <div key={item.id} className="p-4">
          <button type="button" onClick={() => onDetail(item.id)} className="text-left text-base font-semibold text-slate-900 hover:text-[#173052]">{item.name}</button>
          <p className="mt-1 text-sm text-slate-600">{companyMap.get(item.company_id || "")?.name || "Empresa não informada"}{item.title ? ` · ${item.title}` : ""}</p>
          <p className="mt-1 text-sm text-slate-500">{item.whatsapp || item.phone || item.instagram || "Sem telefone informado"}</p>
          <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onAddTask(item.id)}>Follow-up</Button><Button size="sm" variant="outline" onClick={() => onAddInteraction(item.id)}>Interação</Button>{item.company_id && <Button size="sm" variant="outline" onClick={() => onContactVisit(item.company_id!,item.id)}>Registrar visita</Button>}<Button size="sm" variant="outline" onClick={() => onEdit(item)}>Editar</Button><Button size="sm" variant="ghost" onClick={() => onArchive(item)}>Arquivar</Button></div>
        </div>)}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-medium">Contato</th><th className="px-5 py-3 font-medium">Empresa</th><th className="px-5 py-3 font-medium">Telefone</th><th className="px-5 py-3 font-medium">Origem</th><th className="px-5 py-3 font-medium">Responsável</th><th className="px-5 py-3 font-medium">Ações</th></tr></thead>
<tbody className="divide-y divide-slate-100">{contacts.map((item) => <tr key={item.id} className="hover:bg-slate-50"><td className="px-5 py-3"><button type="button" onClick={() => onDetail(item.id)} className="font-medium text-slate-900 hover:text-[#173052]">{item.name}</button><p className="mt-0.5 text-xs text-slate-500">{item.title || item.email || "—"}</p></td><td className="px-5 py-3 text-slate-600">{companyMap.get(item.company_id || "")?.name || "—"}</td><td className="px-5 py-3 text-slate-600">{item.whatsapp || item.phone || "—"}</td><td className="px-5 py-3 text-slate-600">{item.source || "—"}</td><td className="px-5 py-3 text-slate-600">{item.assigned_to || "—"}</td><td className="px-5 py-3"><div className="flex gap-1"><Button type="button" size="icon-sm" variant="ghost" aria-label={`Follow-up para ${item.name}`} onClick={() => onAddTask(item.id)}><CalendarClock className="size-4" /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label={`Registrar interação de ${item.name}`} onClick={() => onAddInteraction(item.id)}><MessageCircle className="size-4" /></Button>{item.company_id && <Button type="button" size="icon-sm" variant="ghost" aria-label={`Registrar visita à empresa de ${item.name}`} onClick={() => onContactVisit(item.company_id!,item.id)}><FilePenLine className="size-4" /></Button>}<Button type="button" size="icon-sm" variant="ghost" aria-label={`WhatsApp de ${item.name}`} onClick={() => onWhatsApp(item.whatsapp || item.phone)}><ExternalLink className="size-4 text-emerald-700" /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label={`Editar ${item.name}`} onClick={() => onEdit(item)}><Pencil className="size-4" /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label={`Arquivar ${item.name}`} onClick={() => onArchive(item)}><Archive className="size-4" /></Button></div></td></tr>)}</tbody></table></div>
      </>}
    </> : companies.length === 0 ? <EmptyState icon={Building2} title="Nenhuma empresa cadastrada" detail="Cadastre uma empresa para vincular os próximos contatos." action="Nova empresa" onClick={onCreateCompany} /> :
      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Field label="Filtrar empresas"><NativeSelect value={diagnosticFilter} onChange={(event) => setDiagnosticFilter(event.target.value)}>
          <option value="all">Todas as empresas</option><option value="completed">Com diagnóstico</option><option value="missing">Sem diagnóstico</option>
          <option value="late">Follow-up atrasado</option><option value="no-next">Visitadas sem próximo passo</option>
          <option value="visited">Visita registrada</option><option value="opportunity">Oportunidade identificada</option>
          <option value="high">Potencial alto</option>
        </NativeSelect></Field>
        <Field label="Relacionamento"><NativeSelect value={relationshipFilter} onChange={(event) => setRelationshipFilter(event.target.value)}><option value="">Todos os status</option>{[...new Set(diagnostics.filter((item) => item.status === "completed").map((item) => item.relationship_status))].map((item) => <option key={item}>{item}</option>)}</NativeSelect></Field>
        <Field label="Potencial"><NativeSelect value={potentialFilter} onChange={(event) => setPotentialFilter(event.target.value)}><option value="">Todos</option>{["Baixo","Médio","Alto"].map((item) => <option key={item}>{item}</option>)}</NativeSelect></Field>
        <Field label="Responsável"><NativeSelect value={diagnosticOwnerFilter} onChange={(event) => setDiagnosticOwnerFilter(event.target.value)}><option value="">Todos</option>{[...new Set(diagnostics.filter((item) => item.status === "completed").map((item) => item.responsible).filter((x): x is string => Boolean(x)))].map((item) => <option key={item}>{item}</option>)}<option value="__none">Sem responsável</option></NativeSelect></Field></div>
        {shownCompanies.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">Nenhuma empresa corresponde a este filtro.</p> :
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shownCompanies.map((company) => {
          const diagnosis = latestDiagnosis(company.id); const task = nextTask(company.id);
          const primary = contacts.find((person) => person.company_id === company.id);
          return <article key={company.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onCompanyDetail(company.id)} className="text-left font-semibold text-slate-900 hover:text-[#173052] hover:underline">{company.name}</button>{company.archived_at && <Badge variant="secondary">Arquivada</Badge>}</div>
            <p className="mt-1 text-sm text-slate-600">{company.segment || company.city || "Segmento a preencher"}</p>
            <p className="mt-3 text-sm text-slate-700">Contato: {primary?.name || "Não informado"}</p>
            <p className="mt-1 text-sm text-slate-600">Status: {diagnosis?.relationship_status || "Sem diagnóstico"}</p>
            <p className="mt-1 text-sm text-slate-600">Potencial: {diagnosis?.potential || "Não avaliado"}</p>
            <p className="mt-1 text-sm text-slate-600">Última visita: {diagnosis ? formatDate(diagnosis.visit_at) : "Ainda não registrada"}</p>
            <p className={`mt-1 text-sm ${task && taskIsLate(task) ? "font-semibold text-rose-700" : "text-slate-600"}`}>Próximo passo: {task ? formatDate(task.due_at,true) : "Sem follow-up agendado"}</p>
            {diagnosis && !task && <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-800">Visita sem retorno agendado</p>}
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3"><Button size="sm" className="bg-[#173052] text-white" onClick={() => onCompanyDetail(company.id)}>Ver ficha</Button>{canEdit && <><Button size="sm" variant="outline" onClick={() => onRegisterVisit(company.id)}>Registrar visita</Button><Button size="sm" variant="ghost" onClick={() => onEditCompany(company)}>Editar</Button>{company.archived_at ? <Button size="sm" variant="ghost" onClick={() => onRestoreCompany(company)}>Restaurar</Button> : <Button size="sm" variant="ghost" onClick={() => onArchiveCompany(company)}>Arquivar</Button>}</>}</div>
          </article>;
        })}</div>}
      </div>}
  </section>;
}

export function PipelineView({ opportunities, contacts, companies, draggedId, setDraggedId, onMove, onCreate, onEdit, onDetail, onToggleDraft, onDelete, stageFilter, setStageFilter, assignedFilter, setAssignedFilter, assignees }: {
  opportunities: Opportunity[]; contacts: Map<string, Contact>; companies: Map<string, Company>;
  draggedId: string | null; setDraggedId: (id: string | null) => void; onMove: (id: string, stage: string) => void;
  onCreate: () => void; onEdit: (opportunity: Opportunity) => void; onDetail: (id: string) => void;
  onToggleDraft: (opportunity: Opportunity) => void; onDelete: (opportunity: Opportunity) => void;
  stageFilter: string; setStageFilter: (value: string) => void; assignedFilter: string; setAssignedFilter: (value: string) => void; assignees: string[];
}) {
  const visibleStages = stageFilter ? [stageFilter] : stages;
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="font-semibold text-slate-900">Oportunidades</h2><p className="mt-1 text-sm text-slate-500">No celular, altere a etapa pelo seletor em cada card.</p></div><Button onClick={onCreate} className="bg-[#173052] text-white hover:bg-[#10233f]"><Plus className="size-4" /> Nova oportunidade</Button></div>
    <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 sm:px-5"><Field label="Etapa"><NativeSelect value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="">Todas as etapas</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}</NativeSelect></Field><Field label="Responsável"><NativeSelect value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value)}><option value="">Todos os responsáveis</option>{assignees.map((name) => <option key={name}>{name}</option>)}</NativeSelect></Field></div>
    {opportunities.length === 0 ? <EmptyState icon={Target} title="Nenhuma oportunidade encontrada" detail="Cadastre uma oportunidade ou ajuste os filtros do funil." action="Nova oportunidade" onClick={onCreate} /> : <div className="overflow-x-auto p-3 sm:p-4"><div className="flex w-full flex-col gap-3 sm:min-h-[400px] sm:w-max sm:flex-row">{visibleStages.map((stage, index) => {
      const items = opportunities.filter((item) => item.stage === stage);
      const accent = ["border-t-[#c5a56a]", "border-t-sky-500", "border-t-blue-500", "border-t-amber-500", "border-t-orange-500", "border-t-rose-500", "border-t-emerald-500", "border-t-slate-500"][stageFilter ? stages.indexOf(stage) : index];
      return <div key={stage} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedId) onMove(draggedId, stage); setDraggedId(null); }} className={`w-full rounded-lg border border-slate-200 border-t-[3px] bg-slate-50/70 sm:w-[300px] ${!items.length ? "max-sm:hidden" : ""} ${accent}`}><div className="flex items-center justify-between p-3"><div><h3 className="text-sm font-semibold text-slate-800">{stage}</h3><p className="mt-1 text-xs text-slate-500">{items.length} oportunidade{items.length === 1 ? "" : "s"}</p></div><Badge variant="secondary" className="bg-white">{items.length}</Badge></div><div className="space-y-2 px-2 pb-3">{items.map((item) => <article key={item.id} draggable onDragStart={() => setDraggedId(item.id)} onDragEnd={() => setDraggedId(null)} className={`rounded-lg border bg-white p-3.5 shadow-sm ${item.is_draft ? "border-dashed border-[#c5a56a] bg-[#fffdf8]" : "border-slate-200"} ${draggedId === item.id ? "opacity-50" : ""}`}><div className="flex items-start justify-between gap-2"><button type="button" onClick={() => onDetail(item.id)} className="text-left text-sm font-semibold text-slate-900 hover:text-[#173052]">{item.title}</button>{item.is_draft && <Badge className="shrink-0 bg-[#f6f0e3] text-[#173052] hover:bg-[#f6f0e3]">Rascunho</Badge>}</div><p className="mt-1 text-xs text-slate-500">{companies.get(item.company_id || "")?.name || contacts.get(item.contact_id || "")?.name || "Sem empresa"}</p><p className="mt-3 text-sm font-semibold text-slate-800">{currency(item.amount)}</p><p className="mt-1 text-xs text-slate-500">{item.assigned_to || "Sem responsável"}</p><div className="mt-3 flex items-center gap-1"><NativeSelect aria-label={`Etapa de ${item.title}`} className="h-9 min-w-0 flex-1 bg-slate-50 text-sm" value={item.stage} onChange={(event) => onMove(item.id, event.target.value)}>{stages.map((option) => <option key={option}>{option}</option>)}</NativeSelect><Button type="button" size="icon-sm" variant="ghost" title={item.is_draft ? "Publicar no funil" : "Deixar como rascunho"} aria-label={item.is_draft ? `Publicar ${item.title}` : `Salvar ${item.title} como rascunho`} onClick={() => onToggleDraft(item)}><FilePenLine className="size-4 text-[#a8864b]" /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label={`Editar ${item.title}`} onClick={() => onEdit(item)}><Pencil className="size-4" /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label={`Excluir ${item.title}`} onClick={() => onDelete(item)}><Trash2 className="size-4 text-rose-600" /></Button></div></article>)}{items.length === 0 && <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">Arraste uma oportunidade aqui</p>}</div></div>;
    })}</div></div>}
  </section>;
}

function localDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function CalendarView({ tasks, contacts, companies, opportunities, onCreateMeeting, onEdit, onComplete, onCancel, onArchive, onDelete, canEdit, canDelete, onOpenRelated }: {
  tasks: Task[]; contacts: Map<string, Contact>; companies: Map<string, Company>; opportunities: Map<string, Opportunity>;
  onCreateMeeting: (date?: Date) => void; onEdit: (task: Task) => void; onComplete: (id: string) => void;
  onCancel: (task: Task) => void; onArchive: (task: Task, restore?: boolean) => void; onDelete: (task: Task) => void;
  canEdit: boolean; canDelete: boolean; onOpenRelated: (task: Task) => void;
}) {
  const [cursor, setCursor] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [mode, setMode] = useState<"month" | "week" | "day">("month");
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const drafts = tasks.filter((item) => item.kind === "Reunião" && !item.archived_at && item.meeting_status === "Rascunho");
  const archived = tasks.filter((item) => item.kind === "Reunião" && item.archived_at);
  const cancelled = tasks.filter((item) => item.kind === "Reunião" && !item.archived_at && item.status === "Cancelada");
  const meetings = tasks.filter((item) => item.kind === "Reunião" && !item.archived_at && item.meeting_status !== "Rascunho" && item.status !== "Cancelada").sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  const monthMeetings = meetings.filter((item) => { const date = new Date(item.due_at); return date.getFullYear() === cursor.getFullYear() && date.getMonth() === cursor.getMonth(); });
  const selectedMeetings = meetings.filter((item) => { const date = new Date(item.due_at); if (mode === "day") return localDateKey(date) === localDateKey(selectedDay); const start = new Date(selectedDay); start.setDate(start.getDate() - start.getDay()); start.setHours(0,0,0,0); const end = new Date(start); end.setDate(start.getDate()+7); return date >= start && date < end; });
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());
  const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(gridStart.getDate() + index); return date; });
  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const todayKey = localDateKey(new Date());
  const changeMonth = (amount: number) => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));

  const MeetingCard = ({ meeting, compact = false }: { meeting: Task; compact?: boolean }) => {
    const related = contacts.get(meeting.contact_id || "")?.name || opportunities.get(meeting.opportunity_id || "")?.title || companies.get(meeting.company_id || "")?.name || "Registro do CRM";
    const completed = meeting.status === "Concluída";
    return <article className={`rounded-lg border p-3 ${completed ? "border-emerald-100 bg-emerald-50/60" : "border-[#eadbb9] bg-[#fffdf8]"}`}>
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className={`truncate text-sm font-semibold ${completed ? "text-emerald-800 line-through" : "text-slate-900"}`}>{meeting.title}</p><p className="mt-1 text-xs text-slate-500">{formatDate(meeting.due_at, true)}</p></div><Badge variant="secondary" className={completed ? "bg-white text-emerald-700" : meeting.meeting_status === "Cancelada" ? "bg-rose-50 text-rose-700" : "bg-[#f6f0e3] text-[#173052]"}>{completed ? "Concluída" : meeting.meeting_status || "Agendada"}</Badge></div>
      {!compact && <><button type="button" onClick={() => onOpenRelated(meeting)} className="mt-2 text-left text-sm text-[#173052] hover:underline">{related}</button><p className="mt-1 text-xs text-slate-500">{meeting.assigned_to || "Sem responsável"}{meeting.participants?.length ? ` · ${meeting.participants.length} participante${meeting.participants.length === 1 ? "" : "s"}` : ""}</p>{meeting.location && <p className="mt-1 truncate text-xs text-slate-500">{meeting.location}</p>}{meeting.agenda && <p className="mt-2 line-clamp-2 text-sm text-slate-600">Pauta: {meeting.agenda}</p>}<div className="mt-3 flex flex-wrap gap-2">{canEdit && <Button size="sm" variant="outline" onClick={() => onEdit(meeting)}>Editar</Button>}{canEdit && !completed && <Button size="sm" variant="outline" onClick={() => onComplete(meeting.id)}><Check className="size-3.5" /> Concluir</Button>}{canEdit && !completed && meeting.status !== "Cancelada" && <Button size="sm" variant="ghost" onClick={() => onCancel(meeting)}>Cancelar</Button>}{canEdit && <Button size="sm" variant="ghost" onClick={() => onArchive(meeting, Boolean(meeting.archived_at))}>{meeting.archived_at ? "Restaurar" : "Arquivar"}</Button>}{canDelete && <Button size="sm" variant="ghost" className="text-rose-700" onClick={() => onDelete(meeting)}>Excluir</Button>}</div></>}
    </article>;
  };

  return <div className="space-y-5">
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-5">
        <div><h2 className="font-semibold text-slate-900">Agenda de reuniões</h2><p className="mt-1 text-sm text-slate-500">Reuniões agendadas ficam salvas junto com os follow-ups.</p></div>
        <div className="flex gap-1 rounded-lg bg-[#f8f6f1] p-1">{(["month","week","day"] as const).map((value) => <Button key={value} size="sm" variant={mode===value?"default":"ghost"} className={mode===value?"bg-[#173052] text-white":""} onClick={() => setMode(value)}>{value==="month"?"Mês":value==="week"?"Semana":"Dia"}</Button>)}</div>
        {canEdit && <Button onClick={() => onCreateMeeting()} className="bg-[#173052] text-white hover:bg-[#10233f]"><Plus className="size-4" /> Agendar reunião</Button>}
      </div>
      {mode === "month" && <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
        <Button type="button" size="icon-sm" variant="outline" aria-label="Mês anterior" onClick={() => changeMonth(-1)}><ChevronLeft className="size-4" /></Button>
        <div className="text-center"><p className="font-semibold capitalize text-slate-900">{monthLabel}</p><button type="button" onClick={() => { const now = new Date(); setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); }} className="mt-0.5 text-xs font-medium text-[#173052] hover:underline">Ir para hoje</button></div>
        <Button type="button" size="icon-sm" variant="outline" aria-label="Próximo mês" onClick={() => changeMonth(1)}><ChevronRight className="size-4" /></Button>
      </div>}

      {mode === "month" && <div className="hidden p-4 md:block">
        <div className="grid grid-cols-7 border-l border-t border-slate-200 text-center text-xs font-medium uppercase tracking-wide text-slate-500">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label) => <div key={label} className="border-b border-r border-slate-200 bg-slate-50 py-2">{label}</div>)}</div>
        <div className="grid grid-cols-7 border-l border-slate-200">{days.map((day) => {
          const key = localDateKey(day);
          const dayMeetings = monthMeetings.filter((item) => localDateKey(item.due_at) === key);
          const currentMonth = day.getMonth() === cursor.getMonth();
          return <div key={key} className={`min-h-32 border-b border-r border-slate-200 p-2 ${currentMonth ? "bg-white" : "bg-slate-50/60"}`}>
            <button type="button" onClick={() => onCreateMeeting(day)} aria-label={`Agendar reunião em ${day.toLocaleDateString("pt-BR")}`} className={`grid size-7 place-items-center rounded-full text-xs font-medium ${key === todayKey ? "bg-[#173052] text-white" : currentMonth ? "text-slate-700 hover:bg-[#f6f0e3]" : "text-slate-400"}`}>{day.getDate()}</button>
            <div className="mt-2 space-y-1.5">{dayMeetings.slice(0, 2).map((meeting) => <button type="button" key={meeting.id} onClick={() => onEdit(meeting)} className={`w-full truncate rounded border px-2 py-1.5 text-left text-xs font-medium ${meeting.status === "Concluída" ? "border-emerald-100 bg-emerald-50 text-emerald-700 line-through" : "border-[#eadbb9] bg-[#fffaf0] text-[#173052]"}`}>{new Date(meeting.due_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {meeting.title}</button>)}{dayMeetings.length > 2 && <p className="px-1 text-[11px] text-slate-500">+ {dayMeetings.length - 2} reunião{dayMeetings.length - 2 === 1 ? "" : "ões"}</p>}</div>
          </div>;
        })}</div>
      </div>}

      {mode === "month" && <div className="divide-y divide-slate-100 md:hidden">{monthMeetings.length ? monthMeetings.map((meeting) => <div key={meeting.id} className="p-4"><MeetingCard meeting={meeting} /></div>) : <EmptyState icon={CalendarDays} title="Nenhuma reunião neste mês" detail="Toque em Agendar reunião para salvar o primeiro compromisso." action="Agendar reunião" onClick={() => onCreateMeeting()} />}</div>}
      {mode !== "month" && <div className="p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-end gap-3"><Field label="Escolha um dia"><Input type="date" value={localDateKey(selectedDay)} onChange={(e) => { if (e.target.value) setSelectedDay(new Date(`${e.target.value}T12:00:00`)); }} /></Field><Button variant="outline" onClick={() => { const next = new Date(selectedDay); next.setDate(next.getDate() - (mode === "week" ? 7 : 1)); setSelectedDay(next); }}>Anterior</Button><Button variant="outline" onClick={() => { const next = new Date(selectedDay); next.setDate(next.getDate() + (mode === "week" ? 7 : 1)); setSelectedDay(next); }}>Próximo</Button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{selectedMeetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)}</div>{!selectedMeetings.length && <p className="py-6 text-center text-sm text-slate-500">Sem reuniões neste período.</p>}</div>}
    </section>

    {drafts.length > 0 && <section className="rounded-xl border border-[#eadbb9] bg-white p-5"><h2 className="font-semibold text-slate-900">Rascunhos ({drafts.length})</h2><div className="mt-3 flex flex-wrap gap-2">{drafts.map((meeting) => <Button key={meeting.id} variant="outline" onClick={() => onEdit(meeting)}>{meeting.title} · {formatDate(meeting.due_at,true)}</Button>)}</div></section>}
    {archived.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Reuniões arquivadas ({archived.length})</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{archived.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)}</div></section>}
    {cancelled.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Reuniões canceladas ({cancelled.length})</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cancelled.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)}</div></section>}
    {mode === "month" && <section className="hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Reuniões do mês ({monthMeetings.length})</h2><p className="mt-1 text-sm text-slate-500">Edite, conclua ou abra o contato e a oportunidade relacionados.</p></div>
      {monthMeetings.length ? <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{monthMeetings.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} />)}</div> : <EmptyState icon={CalendarDays} title="Agenda livre neste mês" detail="As reuniões salvas aparecerão aqui e no calendário acima." action="Agendar reunião" onClick={() => onCreateMeeting()} />}
    </section>}
  </div>;
}

export function TasksView({ tasks, contacts, opportunities, onCreate, onComplete, onEdit, onCancel, statusFilter, setStatusFilter }: {
  tasks: Task[]; contacts: Map<string, Contact>; opportunities: Map<string, Opportunity>; onCreate: () => void;
  onComplete: (id: string) => void; onEdit: (task: Task) => void; onCancel: (task: Task) => void;
  statusFilter: string; setStatusFilter: (status: string) => void;
}) {
  const pending = tasks.filter((item) => item.status === "Pendente");
  const completed = tasks.filter((item) => item.status === "Concluída");
  const cancelled = tasks.filter((item) => item.status === "Cancelada");
  return <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><div className="w-full max-w-xs"><Field label="Status da tarefa"><NativeSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Todos os status</option><option>Pendente</option><option>Concluída</option><option>Cancelada</option></NativeSelect></Field></div><Button onClick={onCreate} className="bg-[#173052] text-white hover:bg-[#10233f]"><Plus className="size-4" /> Agendar follow-up</Button></div><div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]"><section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Pendentes ({pending.length})</h2></div>{pending.length ? <div className="divide-y divide-slate-100">{pending.map((task) => <TaskRow key={task.id} task={task} contactName={contacts.get(task.contact_id || "")?.name} opportunityName={opportunities.get(task.opportunity_id || "")?.title} onComplete={onComplete} onEdit={onEdit} onCancel={onCancel} />)}</div> : <EmptyState icon={CalendarClock} title="Nenhuma tarefa pendente" detail="Os próximos follow-ups aparecerão aqui." action="Agendar tarefa" onClick={onCreate} />}</section><section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Concluídas ({completed.length})</h2></div>{completed.length ? <div className="divide-y divide-slate-100">{completed.map((item) => <div key={item.id} className="px-5 py-4"><p className="text-sm font-medium text-slate-900">{item.title}</p><p className="mt-1 text-xs text-slate-500">{formatDate(item.due_at, true)}</p></div>)}</div> : <p className="p-5 text-sm text-slate-500">Ainda não há tarefas concluídas.</p>}</section></div>{cancelled.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-900">Canceladas ({cancelled.length})</h2><div className="mt-3 space-y-2 text-sm text-slate-600">{cancelled.map((item) => <p key={item.id}>{item.title}</p>)}</div></section>}</div>;
}

function TaskRow({ task, contactName, opportunityName, onComplete, onEdit, onCancel }: { task: Task; contactName?: string; opportunityName?: string; onComplete: (id: string) => void; onEdit?: (task: Task) => void; onCancel?: (task: Task) => void }) {
  const late = taskIsLate(task);
  return <div className="flex items-start gap-3 px-5 py-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-slate-800">{task.title}</p><Badge variant="secondary" className={late ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}>{labelForTask(task)}</Badge></div><p className="mt-1 text-sm text-slate-500">{contactName || opportunityName || "CRM"}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span className={late ? "font-semibold text-rose-700" : ""}>{formatDate(task.due_at, true)}</span><span>Responsável: {task.assigned_to || "Não definido"}</span><span>Prioridade: {task.priority}</span></div>{task.description && <p className="mt-2 text-sm text-slate-600">{task.description}</p>}<div className="mt-3 flex flex-wrap gap-2"><Button size="sm" className="bg-[#173052] text-white" onClick={() => onComplete(task.id)}>Registrar resultado</Button>{onEdit && <Button size="sm" variant="outline" onClick={() => onEdit(task)}>Editar</Button>}{onCancel && <Button size="sm" variant="ghost" onClick={() => onCancel(task)}>Cancelar</Button>}</div></div></div>;
}

export function TeamView({ workspace, owner, userEmail, inviteEmail, setInviteEmail, onInvite, busy }: { workspace: Workspace; owner: boolean; userEmail: string; inviteEmail: string; setInviteEmail: (email: string) => void; onInvite: () => void; busy: boolean }) {
  return <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex items-start gap-4"><span className="grid size-12 place-items-center rounded-xl bg-[#f6f0e3] text-[#173052]"><Users className="size-6" /></span><div><h2 className="text-lg font-semibold text-slate-900">Acesso da equipe</h2><p className="mt-1 text-sm leading-6 text-slate-600">{workspace.name} compartilha contatos, oportunidades, tarefas e histórico.</p></div></div><div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-medium text-slate-800">Seu acesso</p><p className="mt-1 text-sm text-slate-600">{userEmail} · {owner ? "Administrador" : "Membro"}</p><p className="mt-3 text-sm text-slate-600">Os dois usuários podem cadastrar e atualizar os registros comerciais.</p></div>{owner && <form className="mt-5 space-y-3" onSubmit={(event) => { event.preventDefault(); onInvite(); }}><Field label="E-mail do Rudy"><Input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="rudy@exemplo.com" /></Field><Button type="submit" disabled={busy} className="bg-[#173052] text-white hover:bg-[#10233f]">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Gerar convite de uso único</Button></form>}</section><section className="rounded-xl border border-[#eadbb9] bg-[#f6f0e3]/70 p-6"><BadgeCheck className="size-7 text-[#173052]" /><h3 className="mt-4 font-semibold text-slate-900">Convite protegido</h3><p className="mt-2 text-sm leading-6 text-slate-600">O link vence em 7 dias, só funciona uma vez e exige acesso com o e-mail informado acima. Compartilhe diretamente com o Rudy.</p></section></div>;
}

export function HistoryTimeline({ interactions }: { interactions: Interaction[] }) {
  if (!interactions.length) return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Nenhuma conversa registrada ainda.</p>;
  return <ol className="space-y-3">{interactions.map((item) => <li key={item.id} className="rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-slate-800">{item.kind}</strong><time className="text-xs text-slate-500">{formatDate(item.occurred_at, true)}</time></div><p className="mt-2 text-sm leading-6 text-slate-700">{item.summary}</p>{item.result && <p className="mt-2 text-sm text-slate-600">Próximo passo: {item.result}</p>}</li>)}</ol>;
}

function EmptyState({ icon: Icon, title, detail, action, onClick }: { icon: typeof Users; title: string; detail: string; action?: string; onClick?: () => void }) {
  return <div className="px-6 py-12 text-center"><span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#f6f0e3] text-[#173052]"><Icon className="size-5" /></span><h3 className="mt-4 text-sm font-semibold text-slate-800">{title}</h3><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-slate-500">{detail}</p>{action && onClick && <Button variant="outline" className="mt-4 border-slate-200 bg-white text-slate-700" onClick={onClick}><Plus className="size-4 text-[#173052]" />{action}</Button>}</div>;
}
