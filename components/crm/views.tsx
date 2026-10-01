"use client";

import { useState } from "react";
import { Archive, BadgeCheck, Building2, CalendarClock, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, FilePenLine, LoaderCircle, MessageCircle, Pencil, Plus, RotateCcw, Target, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/crm/field";
import { stages, type Company, type CompanyDiagnostic, type Contact, type Interaction, type Opportunity, type Task, type Workspace } from "@/lib/crm-types";
import { opportunityContext } from "@/lib/crm-insights";
import { currency, formatDate, labelForTask, taskIsLate } from "@/lib/crm-utils";

export { DashboardView } from "@/components/crm/action-dashboard";

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

export function PipelineView({ opportunities, contacts, companies, tasks, interactions, canEdit, draggedId, setDraggedId, onMove, onCreate, onEdit, onDetail, onToggleDraft, onDelete, stageFilter, setStageFilter, assignedFilter, setAssignedFilter, assignees }: {
  opportunities: Opportunity[]; contacts: Map<string, Contact>; companies: Map<string, Company>; tasks: Task[]; interactions: Interaction[]; canEdit: boolean;
  draggedId: string | null; setDraggedId: (id: string | null) => void; onMove: (id: string, stage: string) => void;
  onCreate: () => void; onEdit: (opportunity: Opportunity) => void; onDetail: (id: string) => void;
  onToggleDraft: (opportunity: Opportunity) => void; onDelete: (opportunity: Opportunity) => void;
  stageFilter: string; setStageFilter: (value: string) => void; assignedFilter: string; setAssignedFilter: (value: string) => void; assignees: string[];
}) {
  const [scope, setScope] = useState("all");
  const visibleStages = stageFilter ? [stageFilter] : stages;
  const visible = opportunities.filter((item) => scope === "all" || (item.visibility || "team") === scope);
  return <section className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-[#173052]">Oportunidades</h2><p className="mt-1 text-sm text-slate-500">Próximo passo, prazo e responsável sempre à vista.</p></div>{canEdit && <Button onClick={onCreate}><Plus className="size-4" /> Nova oportunidade</Button>}</div>
    <div className="crm-card grid gap-3 sm:grid-cols-3">
      <Field label="Visibilidade"><NativeSelect value={scope} onChange={(event) => setScope(event.target.value)}><option value="all">Todas a que tenho acesso</option><option value="personal">Minhas oportunidades pessoais</option><option value="team">Compartilhadas com a equipe</option></NativeSelect></Field>
      <Field label="Etapa"><NativeSelect value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="">Todas as etapas</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}</NativeSelect></Field>
      <Field label="Responsável"><NativeSelect value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value)}><option value="">Todos os responsáveis</option>{assignees.map((name) => <option key={name}>{name}</option>)}</NativeSelect></Field>
    </div>
    {!visible.length ? <div className="crm-card py-10 text-center"><Target className="mx-auto size-8 text-[#b79558]" /><h3 className="mt-3 font-semibold">Nenhuma oportunidade neste filtro</h3><p className="mt-2 text-sm text-slate-500">Ajuste os filtros ou crie uma oportunidade.</p></div> : <div className="min-w-0 overflow-x-auto pb-3"><div className="flex flex-col gap-4 sm:w-max sm:flex-row">{visibleStages.map((stage) => {
      const items = visible.filter((item) => item.stage === stage);
      return <section key={stage} onDragOver={(event) => { if (canEdit) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); if (canEdit && draggedId) onMove(draggedId, stage); setDraggedId(null); }} className={"w-full rounded-2xl bg-[#eeeae1] p-3 sm:w-[310px] " + (!items.length ? "max-sm:hidden" : "")}>
        <div className="mb-4 flex items-start justify-between px-1 pt-1"><div><h3 className="text-sm font-semibold">{stage}</h3><p className="mt-1 text-xs text-slate-500">{currency(items.filter((item) => !item.is_draft).reduce((sum, item) => sum + Number(item.amount), 0))}</p></div><Badge variant="secondary" className="bg-white">{items.length}</Badge></div>
        <div className="space-y-3">{items.map((item) => { const context = opportunityContext(item, tasks, interactions); return <article key={item.id} draggable={canEdit} onDragStart={() => setDraggedId(item.id)} onDragEnd={() => setDraggedId(null)} className={"rounded-xl bg-white p-4 shadow-sm " + (draggedId === item.id ? "opacity-50" : "")}>
          <div className="mb-3 flex flex-wrap gap-2"><span className="text-[11px] font-medium text-[#947845]">{item.visibility === "personal" ? "Pessoal · só você" : "Equipe"}</span>{item.is_draft && <Badge variant="secondary">Rascunho</Badge>}</div>
          <button type="button" onClick={() => onDetail(item.id)} className="text-left text-sm font-semibold leading-6 text-[#173052]">{item.title}</button>
          <p className="mt-1 text-xs text-slate-500">{companies.get(item.company_id || contacts.get(item.contact_id || "")?.company_id || "")?.name || "Empresa a definir"}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-[#173052]">{item.amount ? currency(item.amount) : "Valor a definir"}</p><span className="text-xs text-slate-500">{item.assigned_to || "Sem responsável"}</span></div>
          <div className="mt-4 rounded-lg bg-[#faf7f0] p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-[#947845]">Próximo passo</p><p className="mt-1 text-xs leading-5 text-slate-700">{context.nextStep}</p>
            <p className={"mt-2 text-xs " + (context.next && taskIsLate(context.next) ? "font-medium text-rose-700" : "text-slate-500")}>{context.next ? "Prazo: " + formatDate(context.next.due_at) : item.expected_close_at ? "Fechamento: " + formatDate(item.expected_close_at + "T12:00:00") : "Prazo a definir"}</p>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Última interação: {context.lastInteraction ? formatDate(context.lastInteraction) : "não registrada"}</p>
          {canEdit && <div className="mt-3 border-t border-slate-100 pt-3"><NativeSelect aria-label={"Etapa de " + item.title} value={item.stage} onChange={(event) => onMove(item.id, event.target.value)}>{stages.map((option) => <option key={option}>{option}</option>)}</NativeSelect><details className="mt-2"><summary className="cursor-pointer py-2 text-xs text-slate-500">Mais ações</summary><div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" onClick={() => onEdit(item)}>Editar</Button><Button size="sm" variant="ghost" onClick={() => onToggleDraft(item)}>{item.is_draft ? "Publicar no funil" : "Tornar rascunho"}</Button><Button size="sm" variant="ghost" className="text-rose-700" onClick={() => onDelete(item)}>Excluir</Button></div></details></div>}
        </article>; })}{!items.length && <p className="rounded-xl border border-dashed border-[#d6cfbf] px-4 py-8 text-center text-xs text-slate-500">Nenhuma oportunidade nesta etapa</p>}</div>
      </section>;
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

export function TasksView({ tasks, contacts, opportunities, onCreate, onComplete, onRegisterResult, onReopen, onEdit, onCancel, statusFilter, setStatusFilter }: {
  tasks: Task[]; contacts: Map<string, Contact>; opportunities: Map<string, Opportunity>; onCreate: () => void;
  onComplete: (id: string) => void; onRegisterResult: (id: string) => void; onReopen: (task: Task) => void;
  onEdit: (task: Task) => void; onCancel: (task: Task) => void;
  statusFilter: string; setStatusFilter: (status: string) => void;
}) {
  const pending = tasks.filter((item) => item.status === "Pendente");
  const completed = tasks.filter((item) => item.status === "Concluída");
  const cancelled = tasks.filter((item) => item.status === "Cancelada");
  const namesFor = (task: Task) => ({ contactName: contacts.get(task.contact_id || "")?.name, opportunityName: opportunities.get(task.opportunity_id || "")?.title });
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"><div className="w-full max-w-xs"><Field label="Status da tarefa"><NativeSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Todos os status</option><option>Pendente</option><option>Concluída</option><option>Cancelada</option></NativeSelect></Field></div><Button onClick={onCreate} className="bg-[#173052] text-white hover:bg-[#10233f]"><Plus className="size-4" /> Agendar follow-up</Button></div>
    <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Pendentes ({pending.length})</h2><p className="mt-1 text-xs text-slate-500">Marque o check para concluir ou abra para ver todas as ações.</p></div>
        {pending.length ? <div className="divide-y divide-slate-100">{pending.map((task) => <TaskRow key={task.id} task={task} {...namesFor(task)} onComplete={onComplete} onRegisterResult={onRegisterResult} onEdit={onEdit} onCancel={onCancel} />)}</div> : <EmptyState icon={CalendarClock} title="Nenhuma tarefa pendente" detail="Os próximos follow-ups aparecerão aqui." action="Agendar tarefa" onClick={onCreate} />}
      </section>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Concluídas ({completed.length})</h2></div>
        {completed.length ? <div className="divide-y divide-slate-100">{completed.map((task) => <TaskRow key={task.id} task={task} {...namesFor(task)} onReopen={onReopen} />)}</div> : <p className="p-5 text-sm text-slate-500">Ainda não há tarefas concluídas.</p>}
      </section>
    </div>
    {cancelled.length > 0 && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 px-5 py-4"><h2 className="font-semibold text-slate-900">Canceladas ({cancelled.length})</h2></div><div className="divide-y divide-slate-100">{cancelled.map((task) => <TaskRow key={task.id} task={task} {...namesFor(task)} onReopen={onReopen} />)}</div></section>}
  </div>;
}

function TaskRow({ task, contactName, opportunityName, onComplete, onRegisterResult, onReopen, onEdit, onCancel }: { task: Task; contactName?: string; opportunityName?: string; onComplete?: (id: string) => void; onRegisterResult?: (id: string) => void; onReopen?: (task: Task) => void; onEdit?: (task: Task) => void; onCancel?: (task: Task) => void }) {
  const [open, setOpen] = useState(false);
  const late = taskIsLate(task);
  const completed = task.status === "Concluída";
  const cancelled = task.status === "Cancelada";
  const related = contactName || opportunityName || "CRM";
  return <article className="px-4 py-4 sm:px-5">
    <div className="flex items-start gap-3">
      <button
        type="button"
        aria-label={completed || cancelled ? `Voltar ${task.title} para pendentes` : `Concluir ${task.title}`}
        title={completed || cancelled ? "Voltar para pendentes" : "Marcar como concluída"}
        onClick={() => completed || cancelled ? onReopen?.(task) : onComplete?.(task.id)}
        className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173052]/40 ${completed ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700" : cancelled ? "border-slate-300 bg-slate-100 text-slate-500 hover:border-[#173052] hover:text-[#173052]" : "border-slate-300 bg-white text-transparent hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"}`}
      >
        {completed ? <Check className="size-4" strokeWidth={3} /> : cancelled ? <RotateCcw className="size-3.5" /> : <Check className="size-4" strokeWidth={3} />}
      </button>
      <button type="button" aria-expanded={open} aria-controls={`task-details-${task.id}`} onClick={() => setOpen((current) => !current)} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#173052]/30">
        <div className="flex flex-wrap items-center gap-2"><p className={`text-sm font-medium ${completed ? "text-slate-500 line-through" : "text-slate-800"}`}>{task.title}</p><Badge variant="secondary" className={late ? "bg-rose-50 text-rose-700" : completed ? "bg-emerald-50 text-emerald-700" : cancelled ? "bg-slate-100 text-slate-500" : "bg-slate-100 text-slate-600"}>{labelForTask(task)}</Badge></div>
        <p className="mt-1 text-sm text-slate-500">{related} · {formatDate(task.due_at, true)}</p>
      </button>
      <Button type="button" size="sm" variant="ghost" aria-expanded={open} aria-controls={`task-details-${task.id}`} onClick={() => setOpen((current) => !current)} className="shrink-0 text-[#173052]">
        {open ? <><ChevronUp className="size-4" /> <span className="hidden sm:inline">Fechar</span></> : <><ChevronDown className="size-4" /> <span className="hidden sm:inline">Abrir</span></>}
      </Button>
    </div>
    {open && <div id={`task-details-${task.id}`} className="ml-10 mt-3 border-l-2 border-[#eadbb9] pl-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>Responsável: {task.assigned_to || "Não definido"}</span><span>Prioridade: {task.priority}</span></div>
      {task.description && <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {!completed && !cancelled && onRegisterResult && <Button size="sm" className="bg-[#173052] text-white" onClick={() => onRegisterResult(task.id)}>Registrar resultado</Button>}
        {!completed && !cancelled && onEdit && <Button size="sm" variant="outline" onClick={() => onEdit(task)}>Editar</Button>}
        {!completed && !cancelled && onCancel && <Button size="sm" variant="ghost" onClick={() => onCancel(task)}>Cancelar</Button>}
        {(completed || cancelled) && onReopen && <Button size="sm" variant="outline" onClick={() => onReopen(task)}><RotateCcw className="size-4" /> Voltar para pendentes</Button>}
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}><ChevronUp className="size-4" /> Fechar</Button>
      </div>
    </div>}
  </article>;
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
