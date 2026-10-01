"use client";

import { useState } from "react";
import { ArrowUpRight, Building2, CalendarDays, Check, ChevronRight, Clock3, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { stages, type BoardActivity, type Company, type CompanyDiagnostic, type Contact, type Interaction, type Opportunity, type Task, type View } from "@/lib/crm-types";
import { currency, formatDate, taskIsLate } from "@/lib/crm-utils";
import { dayKey, isPendingTask, latestDate, opportunityContext } from "@/lib/crm-insights";

type DashboardProps = {
  contacts: Contact[]; companies: Company[]; opportunities: Opportunity[]; tasks: Task[]; interactions: Interaction[]; activities: BoardActivity[]; diagnostics: CompanyDiagnostic[]; canEdit?: boolean;
  onView: (view: View) => void; onCreateTask: () => void; onCompleteTask: (id: string) => void; onCreateOpportunity: () => void; onCreateContact: () => void;
  onCreateCompany: () => void; onCreateMeeting: () => void; onCreateActivity: () => void; onCreateDiagnostic: () => void; onCompanyDetail: (id: string) => void;
  onCreateInteraction: () => void; onContactDetail: (id: string) => void; onOpportunityDetail: (id: string) => void; onOpenStage: (stage: string) => void;
};

export function DashboardView({ contacts, companies, opportunities, tasks, interactions, activities, diagnostics, canEdit, onView, onCompleteTask, onCreateCompany, onCompanyDetail, onOpportunityDetail, onOpenStage }: DashboardProps) {
  const [responsible, setResponsible] = useState("");
  const now = new Date();
  const today = dayKey(now);
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const assignees = [...new Set([...contacts.map((item) => item.assigned_to), ...opportunities.map((item) => item.assigned_to), ...tasks.map((item) => item.assigned_to), ...diagnostics.map((item) => item.responsible)].filter((value): value is string => Boolean(value)))].sort();
  const matches = (value?: string | null) => !responsible || value === responsible;
  const pending = tasks.filter((item) => isPendingTask(item) && matches(item.assigned_to)).sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  const overdue = pending.filter(taskIsLate);
  const todayTasks = pending.filter((item) => dayKey(item.due_at) === today);
  const meetings = tasks.filter((item) => !item.archived_at && item.kind === "Reunião" && !["Rascunho", "Cancelada"].includes(item.meeting_status || "") && item.status !== "Cancelada" && new Date(item.due_at) >= weekStart && new Date(item.due_at) < weekEnd && matches(item.assigned_to)).sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  const deals = opportunities.filter((item) => !item.is_draft && matches(item.assigned_to));
  const openDeals = deals.filter((item) => !["Ganho", "Perdido"].includes(item.stage));
  const idleDeals = openDeals.filter((item) => now.getTime() - new Date(opportunityContext(item, tasks, interactions).lastMovement).getTime() > 14 * 86400000);
  const dormant = companies.filter((company) => {
    if (company.archived_at) return false;
    const people = contacts.filter((item) => item.company_id === company.id);
    const minutes = diagnostics.filter((item) => item.company_id === company.id && item.status === "completed");
    if (responsible && !people.some((item) => matches(item.assigned_to)) && !minutes.some((item) => matches(item.responsible))) return false;
    const companyDeals = opportunities.filter((item) => item.company_id === company.id);
    const last = latestDate([...minutes.map((item) => item.visit_at), ...interactions.filter((item) => people.some((person) => person.id === item.contact_id) || companyDeals.some((deal) => deal.id === item.opportunity_id)).map((item) => item.occurred_at), ...tasks.filter((item) => item.company_id === company.id || people.some((person) => person.id === item.contact_id)).map((item) => item.completed_at)]);
    return last && now.getTime() - new Date(last).getTime() > 30 * 86400000;
  });
  const focusTasks = pending.filter((item) => taskIsLate(item) || dayKey(item.due_at) === today);
  const focus = [
    ...focusTasks.map((item) => ({ id: item.id, label: item.title, detail: (taskIsLate(item) ? "Atrasado · " : "Hoje · ") + formatDate(item.due_at, true), late: taskIsLate(item), task: item, click: () => canEdit ? onCompleteTask(item.id) : onView("tasks") })),
    ...idleDeals.map((item) => ({ id: item.id, label: "Retomar " + item.title, detail: "Sem movimentação registrada há mais de 14 dias", late: false, task: null, click: () => onOpportunityDetail(item.id) })),
    ...dormant.map((item) => ({ id: item.id, label: "Reconectar com " + item.name, detail: "Sem contato registrado há mais de 30 dias", late: false, task: null, click: () => onCompanyDetail(item.id) })),
  ].slice(0, 5);
  const recent = [
    ...diagnostics.filter((item) => item.status === "completed" && matches(item.responsible)).map((item) => ({ id: item.id, title: companies.find((company) => company.id === item.company_id)?.name || "Reunião registrada", detail: item.summary, date: item.visit_at, kind: "Ata de reunião", click: () => onCompanyDetail(item.company_id) })),
    ...interactions.filter((item) => matches(opportunities.find((deal) => deal.id === item.opportunity_id)?.assigned_to || contacts.find((person) => person.id === item.contact_id)?.assigned_to)).map((item) => ({ id: item.id, title: item.summary, detail: item.result || "", date: item.occurred_at, kind: item.kind, click: () => { const company = contacts.find((person) => person.id === item.contact_id)?.company_id; if (company) onCompanyDetail(company); else if (item.opportunity_id) onOpportunityDetail(item.opportunity_id); else onView("contacts"); } })),
    ...activities.filter((item) => item.status === "published" && matches(item.assigned_to)).map((item) => ({ id: item.id, title: item.title, detail: item.description || "", date: item.updated_at, kind: "Atividade", click: () => onView("activities") })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  const companyName = (task: Task) => companies.find((company) => company.id === task.company_id)?.name || contacts.find((person) => person.id === task.contact_id)?.name || task.assigned_to || "Equipe";

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm capitalize text-slate-500">{now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p><div className="w-full sm:w-60"><NativeSelect aria-label="Responsável no dashboard" value={responsible} onChange={(event) => setResponsible(event.target.value)}><option value="">Toda a equipe</option>{assignees.map((name) => <option key={name}>{name}</option>)}</NativeSelect></div></div>
    <section className="overflow-hidden rounded-2xl bg-[#173052] text-white">
      <div className="flex items-center gap-3 px-5 pb-4 pt-6 sm:px-7"><span className="grid size-10 place-items-center rounded-xl bg-[#d8c297] text-[#173052]"><Target className="size-5" /></span><div><h2 className="text-xl font-semibold">Seu foco hoje</h2><p className="mt-1 text-sm text-white/60">Os próximos movimentos da sua carteira.</p></div></div>
      <div className="px-5 pb-6 sm:px-7">{focus.length ? <ol className="divide-y divide-white/10">{focus.map((item, index) => <li key={item.id}><button onClick={item.click} className="group flex w-full items-center gap-3 py-4 text-left"><span className="text-xs tabular-nums text-[#d8c297]">0{index + 1}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-6 sm:text-base">{item.label}</span><span className={"mt-1 block text-xs " + (item.late ? "text-[#f5c7b3]" : "text-white/60")}>{item.detail}</span></span><ChevronRight className="size-4 shrink-0 text-[#d8c297]" /></button></li>)}</ol> : <div className="py-5"><p className="flex items-center gap-2 font-medium"><Check className="size-5 text-[#d8c297]" /> Nenhuma pendência para hoje</p><p className="mt-2 max-w-xl text-sm leading-6 text-white/65">{companies.length ? "Confira a agenda e registre suas conversas para manter os próximos passos em dia." : "Comece com uma empresa. Depois, cada reunião ajuda a construir o relacionamento."}</p>{!companies.length && canEdit && <Button variant="secondary" className="mt-4" onClick={onCreateCompany}>Cadastrar primeira empresa</Button>}</div>}</div>
    </section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
      { label: "Follow-ups de hoje", value: todayTasks.length, detail: "Contatos e tarefas previstos", icon: Clock3, click: () => onView("tasks") },
      { label: "Tarefas atrasadas", value: overdue.length, detail: overdue.length ? "Precisam de um próximo passo" : "Tudo em dia", icon: Target, click: () => onView("tasks") },
      { label: "Reuniões da semana", value: meetings.length, detail: "Segunda a domingo", icon: CalendarDays, click: () => onView("calendar") },
      { label: "Valor do funil", value: currency(openDeals.reduce((sum, item) => sum + Number(item.amount || 0), 0)), detail: openDeals.length + " oportunidades abertas", icon: Building2, click: () => onView("pipeline") },
    ].map(({ label, value, detail, icon: Icon, click }) => <button key={label} onClick={click} className="crm-card text-left"><div className="flex items-center justify-between gap-2"><span className="text-sm text-slate-500">{label}</span><Icon className="size-4 text-[#a78a55]" /></div><p className="mt-3 text-2xl font-semibold tracking-tight text-[#173052]">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></button>)}</div>
    <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <section className="crm-card"><div className="mb-4 flex items-center justify-between gap-2"><h2 className="font-semibold">Reuniões desta semana</h2><Button size="sm" variant="ghost" onClick={() => onView("calendar")}>Agenda <ArrowUpRight className="size-4" /></Button></div>{meetings.length ? <div className="divide-y divide-slate-100">{meetings.slice(0, 5).map((item) => <button key={item.id} onClick={() => onView("calendar")} className="flex w-full items-start gap-4 py-4 text-left"><span className="rounded-xl bg-[#f2eadb] px-3 py-2 text-center text-lg font-semibold text-[#806738]">{new Date(item.due_at).getDate()}</span><span className="min-w-0"><span className="block text-sm font-medium">{item.title}</span><span className="mt-1 block text-xs text-slate-500">{companyName(item)} · {formatDate(item.due_at, true)}</span><span className="mt-1 block text-xs text-[#947845]">{item.status === "Concluída" ? "Realizada" : "Agendada"}</span></span></button>)}</div> : <p className="py-6 text-sm text-slate-500">Nenhuma reunião nesta semana.</p>}</section>
      <section className="crm-card"><div className="mb-5 flex items-center justify-between gap-2"><h2 className="font-semibold">Oportunidades por etapa</h2><Button size="sm" variant="ghost" onClick={() => onView("pipeline")}>Funil <ArrowUpRight className="size-4" /></Button></div><div className="space-y-4">{stages.map((stage) => { const items = deals.filter((item) => item.stage === stage); return <button key={stage} onClick={() => onOpenStage(stage)} className="block w-full text-left"><div className="mb-2 flex justify-between gap-2 text-xs"><span className="text-slate-600">{stage}</span><span className="font-medium text-[#173052]">{items.length} · {currency(items.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#f1eee8]"><div className="h-full rounded-full bg-[#c2a66e]" style={{ width: (deals.length ? items.length / deals.length * 100 : 0) + "%" }} /></div></button>; })}</div></section>
    </div>
    <div className="grid gap-6 xl:grid-cols-2">
      <section className="crm-card"><h2 className="font-semibold">Relacionamentos pedindo atenção</h2><p className="mt-1 text-xs text-slate-500">Oportunidades sem movimento há 14 dias; empresas sem contato há 30 dias.</p><div className="mt-4 space-y-2">{idleDeals.slice(0, 3).map((item) => <button key={item.id} className="flex w-full items-center justify-between gap-3 rounded-xl bg-[#faf6ed] p-3 text-left" onClick={() => onOpportunityDetail(item.id)}><span className="text-sm">{item.title}<span className="mt-1 block text-xs text-[#947845]">Oportunidade sem movimentação</span></span><ChevronRight className="size-4 shrink-0" /></button>)}{dormant.slice(0, 3).map((item) => <button key={item.id} className="flex w-full items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-left" onClick={() => onCompanyDetail(item.id)}><span className="text-sm">{item.name}<span className="mt-1 block text-xs text-slate-500">Sem contato recente</span></span><ChevronRight className="size-4 shrink-0" /></button>)}</div>{!idleDeals.length && !dormant.length && <p className="py-5 text-sm text-slate-500">Nenhum relacionamento com esses sinais de atenção.</p>}</section>
      <section className="crm-card"><h2 className="mb-5 font-semibold">Atividades recentes</h2>{recent.length ? <ol className="space-y-4">{recent.map((item) => <li key={item.id}><button className="w-full text-left" onClick={item.click}><span className="text-xs text-[#947845]">{item.kind} · {formatDate(item.date)}</span><span className="mt-1 block text-sm font-medium">{item.title}</span><span className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.detail}</span></button></li>)}</ol> : <p className="text-sm text-slate-500">As novas conversas, atas e atividades aparecerão aqui.</p>}</section>
    </div>
  </div>;
}
