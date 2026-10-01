"use client";

import { useState } from "react";
import { Activity, CalendarClock, CalendarDays, FileText, MapPin, MessageCircle, Pencil, Plus, Target, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HistoryTimeline } from "@/components/crm/views";
import type { Company, CompanyDiagnostic, Contact, DiagnosticIdea, Interaction, Opportunity, Task } from "@/lib/crm-types";
import { currency, formatDate, safeExternalUrl, taskIsLate } from "@/lib/crm-utils";

const systemBusinessKeys = ["visit_time_known", "attachment_path", "attachment_name", "source_meeting_id", "source_meeting_title"];

export function CompanyProfile({ company, contacts, diagnostics, opportunities, tasks, interactions, canEdit,
  onRegister, onEditDiagnostic, onArchiveDiagnostic, onCreateOpportunity, onAddTask, onAddInteraction, onEditCompany, onOpenAttachment }: {
  company: Company; contacts: Contact[]; diagnostics: CompanyDiagnostic[]; opportunities: Opportunity[];
  tasks: Task[]; interactions: Interaction[]; canEdit: boolean;
  onRegister: (meeting?: Task) => void; onEditDiagnostic: (item: CompanyDiagnostic) => void;
  onArchiveDiagnostic: (item: CompanyDiagnostic) => void;
  onCreateOpportunity: (item: CompanyDiagnostic, idea: DiagnosticIdea) => void;
  onAddTask: (contactId?: string) => void; onAddInteraction: (contactId?: string) => void;
  onEditCompany: () => void; onOpenAttachment: (path: string) => void;
}) {
  const [tab, setTab] = useState<"overview" | "meetings" | "history" | "people">("overview");
  const sortedDiagnostics = [...diagnostics].sort((a,b) => new Date(b.visit_at).getTime() - new Date(a.visit_at).getTime());
  const current = sortedDiagnostics.find((item) => item.status === "completed");
  const openDeals = opportunities.filter((item) => !item.is_draft && !["Ganho","Perdido"].includes(item.stage));
  const pending = tasks.filter((item) => item.status === "Pendente" && !item.archived_at).sort((a,b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  const next = pending[0];
  const firstContact = contacts[0];
  const companySummary = current?.business_details || {};
  const meetingTasks = tasks.filter((item) => item.kind === "Reunião" && !item.archived_at).sort((a,b) => new Date(b.due_at).getTime() - new Date(a.due_at).getTime());
  const linkedMeetingIds = new Set(diagnostics.map((item) => item.business_details?.source_meeting_id).filter(Boolean));
  const meetingsWithoutMinutes = meetingTasks.filter((item) => !linkedMeetingIds.has(item.id));
  const businessLabels: Record<string,string> = {
    contact_title:"Cargo da pessoa visitada", history:"História", years:"Tempo de mercado", region:"Região", segment:"Segmento",
    products:"Produtos e serviços", audience:"Público-alvo", model:"Modelo de negócio", differentials:"Diferenciais",
    acquisition:"Aquisição de clientes", sales:"Operação comercial", channels:"Canais", size:"Porte informado",
    digital:"Presença digital", employees:"Equipe informada", other:"Outros detalhes", raw_notes:"Relato original",
  };
  const visibleBusinessDetails = (details: Record<string,string>) => Object.entries(details).filter(([key,value]) => !systemBusinessKeys.includes(key) && Boolean(value));
  const contactName = (id?: string | null) => contacts.find((item) => item.id === id)?.name;
  const items = [
    ...diagnostics.map((d) => ({ id: `diagnostic-${d.id}`, when: d.visit_at, withTime: d.business_details?.visit_time_known !== "false", kind: d.visit_kind,
      title: d.status === "draft" ? "Ata em rascunho" : d.summary, detail: d.next_action ? `Próximo passo: ${d.next_action}` : "", assignee: d.responsible || "Sem responsável" })),
    ...interactions.map((i) => ({ id: `interaction-${i.id}`, when: i.occurred_at, withTime: true, kind: i.kind,
      title: i.summary, detail: i.result ? `Próximo passo: ${i.result}` : "", assignee: "Equipe" })),
    ...tasks.map((t) => ({ id: `task-${t.id}`, when: t.completed_at || t.created_at, withTime: true, kind: t.kind === "Reunião" ? "Reunião agendada" : t.status === "Concluída" ? "Follow-up concluído" : "Follow-up agendado",
      title: t.title, detail: `Prazo: ${formatDate(t.due_at,true)}`, assignee: t.assigned_to || "Sem responsável" })),
    ...opportunities.map((o) => ({ id: `opportunity-${o.id}`, when: o.created_at, withTime: true, kind: "Oportunidade",
      title: o.title, detail: o.stage, assignee: o.assigned_to || "Sem responsável" })),
  ].sort((a,b) => new Date(b.when).getTime() - new Date(a.when).getTime());

  return <div className="space-y-5">
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600"><span>{company.segment || "Segmento a preencher"}{company.city ? ` · ${company.city}` : ""}</span>{company.phone && <span>{company.phone}</span>}{safeExternalUrl(company.website) && <a className="text-[#173052] underline" href={safeExternalUrl(company.website)!} target="_blank" rel="noopener noreferrer">Site</a>}{safeExternalUrl(company.instagram) && <a className="text-[#173052] underline" href={safeExternalUrl(company.instagram)!} target="_blank" rel="noopener noreferrer">Instagram</a>}</div>
    <div className="grid gap-3 rounded-xl border border-[#eadbb9] bg-[#faf6ed] p-4 sm:grid-cols-3">
      <div><p className="text-xs uppercase tracking-wide text-[#816736]">Relacionamento</p><p className="mt-1 font-semibold text-[#173052]">{current?.relationship_status || "Sem ata concluída"}</p></div>
      <div><p className="text-xs uppercase tracking-wide text-[#816736]">Última reunião</p><p className="mt-1 font-semibold text-[#173052]">{current ? formatDate(current.visit_at) : "Ainda não registrada"}</p></div>
      <div><p className="text-xs uppercase tracking-wide text-[#816736]">Próximo follow-up</p><p className={`mt-1 font-semibold ${next && taskIsLate(next) ? "text-rose-700" : "text-[#173052]"}`}>{next ? formatDate(next.due_at,true) : "A definir"}</p></div>
    </div>
    <div className="flex flex-wrap gap-2">
      {canEdit && !company.archived_at && <Button className="bg-[#173052] text-white" onClick={() => onRegister()}><Plus className="size-4" /> Adicionar ata da reunião</Button>}
      {canEdit && !company.archived_at && <Button variant="outline" onClick={() => onAddTask(firstContact?.id)}><CalendarClock className="size-4" /> Agendar follow-up</Button>}
      {canEdit && !company.archived_at && <Button variant="outline" onClick={() => onAddInteraction(firstContact?.id)}><MessageCircle className="size-4" /> Registrar conversa</Button>}
      {canEdit && <Button variant="ghost" onClick={onEditCompany}><Pencil className="size-4" /> Editar empresa</Button>}
    </div>
    <div className="flex gap-5 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Ficha da empresa">
      {([ ["overview","Visão geral"], ["meetings",`Reuniões (${sortedDiagnostics.length})`], ["history","Histórico"], ["people","Contatos"] ] as const).map(([id,label]) =>
        <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)} className={`shrink-0 border-b-2 py-2 text-sm font-medium ${tab === id ? "border-[#173052] text-[#173052]" : "border-transparent text-slate-600"}`}>{label}</button>)}
    </div>

    {tab === "overview" && <div className="space-y-5">
      {current ? <>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-4"><p className="text-sm text-slate-500">Responsável</p><strong className="text-[#173052]">{current.responsible || "Sem responsável"}</strong></div>
          <div className="rounded-lg border border-slate-200 p-4"><p className="text-sm text-slate-500">Potencial</p><strong className="text-[#173052]">{current.potential || "Ainda não avaliado"}</strong></div>
          <div className="rounded-lg border border-slate-200 p-4"><p className="text-sm text-slate-500">Oportunidades abertas</p><strong className="text-[#173052]">{openDeals.length}</strong></div>
        </div>
        <section><h3 className="mb-2 font-semibold text-[#173052]">Resumo da última reunião</h3><p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">{current.summary}</p></section>
        {visibleBusinessDetails(companySummary).length > 0 && <section><h3 className="mb-2 font-semibold text-[#173052]">Detalhes do negócio</h3><div className="grid gap-3 sm:grid-cols-2">{visibleBusinessDetails(companySummary).map(([key,value]) => <div key={key} className="rounded-lg border border-slate-200 p-3"><p className="text-xs font-semibold text-slate-500">{businessLabels[key] || key}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{value}</p></div>)}</div></section>}
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-[#173052]">Principais dores</h3>{current.pains.length ? <ul className="mt-3 space-y-2">{current.pains.map((pain,index) => <li key={index} className="flex items-start justify-between gap-2 text-sm text-slate-700"><span>• {pain.text}</span><Badge variant="secondary">{pain.priority}</Badge></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Ainda não mapeadas.</p>}</section>
          <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-[#173052]">Principais desejos</h3>{current.desires.length ? <ul className="mt-3 space-y-2 text-sm text-slate-700">{current.desires.map((item,index) => <li key={index}>• {item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">Ainda não mapeados.</p>}</section>
        </div>
        <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-[#173052]">Oportunidades sugeridas</h3>{current.ideas.length ? <div className="mt-3 space-y-3">{current.ideas.map((idea,index) => <div key={index} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"><div><p className="font-medium text-slate-800">{idea.title}</p><p className="text-sm text-slate-600">{idea.type}{idea.potential ? ` · Potencial ${idea.potential}` : ""}{idea.amount ? ` · ${currency(idea.amount)}` : ""}</p>{idea.description && <p className="mt-1 text-sm text-slate-600">{idea.description}</p>}</div>{canEdit && <Button size="sm" variant="outline" onClick={() => onCreateOpportunity(current,idea)}><Target className="size-4" /> Criar negócio no funil</Button>}</div>)}</div> : <p className="mt-2 text-sm text-slate-500">Nenhuma oportunidade sugerida.</p>}</section>
        <section className="rounded-xl border border-[#eadbb9] bg-[#faf6ed] p-4"><h3 className="font-semibold text-[#173052]">Próximo passo</h3><p className="mt-2 text-sm text-slate-700">{current.next_action || "A definir"}</p><p className="mt-1 text-sm text-slate-600">{current.next_due_at ? formatDate(current.next_due_at,true) : "Sem data marcada"}{current.task_id ? " · Follow-up agendado" : ""}</p></section>
      </> : <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center"><CalendarDays className="mx-auto size-7 text-slate-400" /><p className="mt-2 font-medium text-[#173052]">Nenhuma ata registrada</p><p className="mt-1 text-sm text-slate-600">Adicione a primeira reunião para começar o histórico deste cliente.</p>{canEdit && <Button className="mt-4 bg-[#173052] text-white" onClick={() => onRegister()}><Plus className="size-4" /> Adicionar ata</Button>}</div>}
    </div>}

    {tab === "meetings" && <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-[#173052]">Histórico de reuniões e atas</h3><p className="text-sm text-slate-600">Cada ata fica salva separadamente e nunca substitui as anteriores.</p></div>{canEdit && <Button className="bg-[#173052] text-white" onClick={() => onRegister()}><Plus className="size-4" /> Nova ata</Button>}</div>
      {meetingsWithoutMinutes.length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4"><h4 className="font-semibold text-amber-950">Reuniões sem ata ({meetingsWithoutMinutes.length})</h4><div className="mt-3 space-y-3">{meetingsWithoutMinutes.map((meeting) => { const future = new Date(meeting.due_at).getTime() > Date.now(); return <div key={meeting.id} className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-medium text-slate-800">{meeting.title}</p><Badge variant="secondary">{future ? "Agendada" : "Ata pendente"}</Badge></div><p className="mt-1 text-sm text-slate-600">{formatDate(meeting.due_at,true)}{contactName(meeting.contact_id) ? ` · ${contactName(meeting.contact_id)}` : ""}</p></div>{canEdit && <Button size="sm" variant="outline" onClick={() => onRegister(meeting)}><FileText className="size-4" /> Adicionar ata</Button>}</div>; })}</div></section>}
      {sortedDiagnostics.length ? <div className="space-y-4">{sortedDiagnostics.map((item) => { const pendingSections = [!item.summary.trim() && "resumo", !visibleBusinessDetails(item.business_details).length && "negócio", !item.pains.length && "dores", !item.desires.length && "desejos", !item.next_action && "próximo passo"].filter(Boolean); return <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-[#173052]">{item.business_details.source_meeting_title || item.visit_kind}</h4><Badge variant="secondary">{item.status === "draft" ? "Rascunho" : item.status === "archived" ? "Arquivada" : "Ata salva"}</Badge></div><p className="mt-1 text-sm font-medium text-slate-700">{formatDate(item.visit_at,item.business_details?.visit_time_known !== "false")}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">{contactName(item.contact_id) && <span><Users className="mr-1 inline size-3.5" />{contactName(item.contact_id)}</span>}{item.attendees && <span>Presentes: {item.attendees}</span>}{item.location && <span><MapPin className="mr-1 inline size-3.5" />{item.location}</span>}{item.responsible && <span>Responsável: {item.responsible}</span>}</div></div><div className="flex shrink-0 flex-wrap gap-2">{item.business_details.attachment_path && <Button variant="outline" size="sm" onClick={() => onOpenAttachment(item.business_details.attachment_path)}><FileText className="size-4" /> Ata original</Button>}{canEdit && <Button variant="outline" size="sm" onClick={() => onEditDiagnostic(item)}>Editar</Button>}{canEdit && item.status === "completed" && <Button variant="ghost" size="sm" onClick={() => onArchiveDiagnostic(item)}>Arquivar</Button>}</div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_240px]"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumo</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.summary || "Resumo ainda não preenchido"}</p></div><div className="rounded-lg bg-[#faf6ed] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#816736]">Próxima ação</p><p className="mt-1 text-sm text-slate-700">{item.next_action || "A definir"}</p>{item.next_due_at && <p className="mt-1 text-xs text-slate-500">Follow-up: {formatDate(item.next_due_at,true)}</p>}</div></div>
        {item.status === "draft" && pendingSections.length > 0 && <p className="mt-3 text-xs text-slate-500">Para revisar, se houver informações: {pendingSections.join(", ")}.</p>}
      </article>; })}</div> : <p className="rounded-lg border border-dashed border-slate-300 p-5 text-sm text-slate-600">Ainda não há reuniões com ata neste cliente.</p>}
    </div>}

    {tab === "history" && <div className="space-y-5"><h3 className="font-semibold text-[#173052]">Linha do tempo completa</h3>{items.length ? <ol className="space-y-2">{items.map((item) => <li key={item.id} className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm text-[#173052]">{item.kind}</strong><time className="text-sm text-slate-500">{formatDate(item.when,item.withTime)}</time></div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.assignee}{item.detail ? ` · ${item.detail}` : ""}</p></li>)}</ol> : <p className="text-sm text-slate-500">Nenhum registro nesta empresa.</p>}<h3 className="font-semibold text-[#173052]">Conversas vinculadas</h3><HistoryTimeline interactions={interactions} /></div>}
    {tab === "people" && <div className="space-y-3">{contacts.length ? contacts.map((person) => <div key={person.id} className="rounded-lg border border-slate-200 p-4"><p className="font-medium text-[#173052]">{person.name}</p><p className="text-sm text-slate-600">{person.title || "Cargo não informado"} · {person.whatsapp || person.phone || "Sem telefone"}</p></div>) : <p className="text-sm text-slate-500">Nenhum contato vinculado.</p>}<p className="text-sm text-slate-500"><Activity className="mr-1 inline size-4" /> Os registros dessa empresa são compartilhados com a equipe.</p></div>}
  </div>;
}
