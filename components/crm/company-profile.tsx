"use client";

import { useId, useState } from "react";
import { ArrowUpRight, Building2, CalendarClock, FileText, MessageCircle, Pencil, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Company, CompanyDiagnostic, Contact, DiagnosticIdea, Interaction, Opportunity, Task } from "@/lib/crm-types";
import { currency, formatDate, safeExternalUrl, taskIsLate } from "@/lib/crm-utils";
import { companyKnowledge, isPendingTask, latestDate } from "@/lib/crm-insights";

const tabs = [["overview", "Visão geral"], ["history", "Histórico"], ["opportunities", "Oportunidades"], ["meetings", "Reuniões e atas"], ["connections", "Conexões"], ["data", "Dados da empresa"]] as const;
const businessLabels: Record<string, string> = { contact_title: "Cargo do contato", history: "História e operação", years: "Tempo de mercado", region: "Região", segment: "Segmento", products: "Produtos e serviços", audience: "Público", model: "Modelo de negócio", differentials: "Diferenciais", acquisition: "Aquisição de clientes", sales: "Operação comercial", channels: "Canais", size: "Porte", digital: "Presença digital", employees: "Equipe", other: "Outros detalhes" };

export function CompanyProfile({ company, contacts, diagnostics, opportunities, tasks, interactions, canEdit,
  onRegister, onEditDiagnostic, onArchiveDiagnostic, onCreateOpportunity, onNewOpportunity, onOpportunityDetail, onAddTask, onAddInteraction, onEditCompany, onOpenAttachment }: {
  company: Company; contacts: Contact[]; diagnostics: CompanyDiagnostic[]; opportunities: Opportunity[];
  tasks: Task[]; interactions: Interaction[]; canEdit: boolean;
  onRegister: (meeting?: Task) => void; onEditDiagnostic: (item: CompanyDiagnostic) => void;
  onArchiveDiagnostic: (item: CompanyDiagnostic) => void;
  onCreateOpportunity: (item: CompanyDiagnostic, idea: DiagnosticIdea) => void;
  onNewOpportunity: () => void; onOpportunityDetail: (id: string) => void;
  onAddTask: (contactId?: string) => void; onAddInteraction: (contactId?: string) => void;
  onEditCompany: () => void; onOpenAttachment: (path: string) => void;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("overview");
  const panelId = useId();
  const { current, details, potential, responsible, contactId, painsSource, desiresSource, ideas } = companyKnowledge(diagnostics);
  const sorted = [...diagnostics].sort((a, b) => new Date(b.visit_at).getTime() - new Date(a.visit_at).getTime());
  const openDeals = opportunities.filter((item) => !item.is_draft && !["Ganho", "Perdido"].includes(item.stage));
  const next = tasks.filter(isPendingTask).sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0];
  const primaryContact = contacts.find((item) => item.id === contactId) || contacts[0];
  const lastContact = latestDate([current?.visit_at, ...interactions.map((item) => item.occurred_at), ...tasks.filter((item) => item.status === "Concluída").map((item) => item.completed_at)]);
  const linkedMeetings = new Set(diagnostics.map((item) => item.business_details.source_meeting_id).filter(Boolean));
  const withoutMinutes = tasks.filter((item) => item.kind === "Reunião" && !item.archived_at && item.meeting_status !== "Cancelada" && item.status !== "Cancelada" && !linkedMeetings.has(item.id));
  const editable = canEdit && !company.archived_at;
  const timeline = [
    ...diagnostics.map((item) => ({ id: "meeting-" + item.id, date: item.visit_at, kind: item.status === "draft" ? "Ata em rascunho" : item.status === "archived" ? "Ata arquivada" : item.visit_kind, title: item.summary || "Reunião sem resumo", detail: item.next_action, attachment: item.business_details.attachment_path })),
    ...interactions.map((item) => ({ id: "interaction-" + item.id, date: item.occurred_at, kind: item.kind === "Nota" ? "Observação" : item.kind, title: item.summary, detail: item.result, attachment: undefined })),
    ...tasks.map((item) => ({ id: "task-" + item.id, date: item.completed_at || item.created_at, kind: item.kind + " · " + item.status, title: item.title, detail: "Prazo: " + formatDate(item.due_at, true), attachment: undefined })),
    ...opportunities.map((item) => ({ id: "deal-" + item.id, date: item.created_at, kind: item.is_draft ? "Oportunidade em rascunho" : "Oportunidade", title: item.title, detail: item.stage, attachment: undefined })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const timelineList = (limit?: number) => timeline.length ? <ol className="relative space-y-5 border-l border-[#ded8cb] pl-5">{timeline.slice(0, limit).map((item) => <li key={item.id} className="relative min-w-0">
    <span className="absolute -left-[25px] top-1.5 size-2 rounded-full bg-[#b79558] ring-4 ring-white" />
    <div className="flex flex-wrap items-center justify-between gap-1 text-xs"><span className="font-semibold text-[#806738]">{item.kind}</span><time className="text-slate-500">{formatDate(item.date)}</time></div>
    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{item.title}</p>
    {item.detail && <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>}
    {item.attachment && <Button size="sm" variant="link" className="px-0" onClick={() => onOpenAttachment(item.attachment!)}><FileText className="size-4" /> Abrir ata original</Button>}
  </li>)}</ol> : <p className="text-sm text-slate-500">As reuniões, conversas e próximos passos aparecerão aqui.</p>;

  const suggestionCards = (limit?: number) => ideas.length ? <div className="grid gap-3 sm:grid-cols-2">{ideas.slice(0, limit).map(({ meeting, idea }, index) => <article key={meeting.id + index} className="rounded-xl bg-[#f8f5ed] p-4">
    <Badge variant="secondary" className="bg-[#ede4ce] text-[#705c35]">Em análise</Badge><h4 className="mt-2 font-medium text-[#173052]">{idea.title}</h4>
    <p className="mt-1 text-sm leading-6 text-slate-600">{idea.description}</p><p className="mt-2 text-xs text-slate-500">{idea.type} · Reunião de {formatDate(meeting.visit_at)}</p>
    {editable && <Button className="mt-3 h-auto whitespace-normal px-0 text-left" variant="link" onClick={() => onCreateOpportunity(meeting, idea)}>Revisar e criar oportunidade <ArrowUpRight className="size-4 shrink-0" /></Button>}
  </article>)}</div> : <p className="text-sm text-slate-500">Nenhuma oportunidade sugerida nas atas.</p>;

  return <div className="min-w-0 space-y-6">
    <div className="rounded-2xl bg-[#173052] p-5 text-white sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-white/10 px-3 py-1 text-xs text-[#eadbb9]">{current?.relationship_status || "Relacionamento a definir"}</span><span className="text-xs text-white/70">Potencial {potential?.toLowerCase() || "a avaliar"}</span></div>
      <p className="mt-4 flex items-center gap-2 text-sm text-white/70"><Building2 className="size-4 shrink-0" />{company.segment || details.segment || "Segmento a informar"}{company.city ? " · " + company.city : ""}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div><p className="text-xs text-white/60">Contato principal</p><p className="mt-1 font-medium">{primaryContact?.name || "A definir"}</p>{primaryContact?.title && <p className="mt-1 text-xs text-white/70">{primaryContact.title}</p>}</div>
        <div><p className="text-xs text-white/60">Responsável</p><p className="mt-1 font-medium">{responsible || primaryContact?.assigned_to || "A definir"}</p></div>
        <div><p className="text-xs text-white/60">Última interação</p><p className="mt-1 font-medium">{lastContact ? formatDate(lastContact) : "Ainda não registrada"}</p></div>
      </div>
    </div>
    <div className="grid gap-4 rounded-2xl bg-[#eee3cd] p-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-widest text-[#806738]">Próximo passo</p>
        <p className="mt-2 text-lg font-semibold leading-snug text-[#173052]">{next?.title || current?.next_action || "Definir o próximo contato"}</p>
        <p className={"mt-2 text-sm " + (next && taskIsLate(next) ? "font-medium text-rose-700" : "text-[#6d624e]")}><CalendarClock className="mr-1.5 inline size-4" />{next ? (taskIsLate(next) ? "Atrasado · " : "Follow-up · ") + formatDate(next.due_at, true) : current?.next_due_at ? "Data na ata: " + formatDate(current.next_due_at) + " · sem tarefa pendente" : "Follow-up a definir"}</p>
      </div>{editable && <Button variant="outline" className="bg-white/70" onClick={() => onAddTask(primaryContact?.id)}>Agendar follow-up</Button>}
    </div>
    <div className="flex flex-wrap gap-2">{editable && <><Button onClick={() => onRegister()}><Plus className="size-4" /> Registrar reunião</Button><Button variant="ghost" onClick={() => onAddInteraction(primaryContact?.id)}><MessageCircle className="size-4" /> Observação</Button></>}{canEdit && <Button variant="ghost" onClick={onEditCompany}><Pencil className="size-4" /> Editar dados</Button>}</div>
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#f0ede6] p-1 sm:grid-cols-3 lg:grid-cols-6" role="tablist" aria-label="Perfil da empresa">{tabs.map(([id, label], index) => <button key={id} id={panelId + id} role="tab" type="button" aria-selected={tab === id} aria-controls={panelId + "panel"} tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} onKeyDown={(event) => {
      const nextIndex = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
      if (nextIndex >= 0) { event.preventDefault(); setTab(tabs[nextIndex][0]); document.getElementById(panelId + tabs[nextIndex][0])?.focus(); }
    }} className={"min-h-11 rounded-lg px-2 py-2 text-sm font-medium transition-colors " + (tab === id ? "bg-white text-[#173052] shadow-sm" : "text-slate-600 hover:bg-white/60")}>{label}</button>)}</div>
    <div id={panelId + "panel"} role="tabpanel" aria-labelledby={panelId + tab} className="space-y-6">
      {tab === "overview" && <>
        <section className="crm-card"><h3 className="mb-3 font-semibold text-[#173052]">Quem é esta empresa?</h3><p className="whitespace-pre-wrap text-sm leading-7 text-slate-600">{details.history || company.observations || "Registre uma reunião para construir o contexto desta empresa."}</p></section>
        <div className="grid gap-4 sm:grid-cols-2">{[{ label: "Principais dores", source: painsSource, entries: painsSource?.pains.map((item) => item.text) }, { label: "Principais desejos", source: desiresSource, entries: desiresSource?.desires }].map(({ label, source, entries }) => <section key={label} className="crm-card">
          <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-[#173052]">{label}</h3>{editable && source && <Button size="icon-sm" variant="ghost" aria-label={"Editar " + label.toLowerCase()} onClick={() => onEditDiagnostic(source)}><Pencil className="size-4" /></Button>}</div>
          {entries?.length ? <ul className="mt-3 space-y-3">{entries.map((text, index) => <li key={index} className="flex gap-2 text-sm leading-6 text-slate-600"><span className="mt-2.5 size-1 shrink-0 rounded-full bg-[#b79558]" />{text}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500">Ainda não informado. Pode ser preenchido depois.</p>}
          {source && <p className="mt-3 text-xs text-slate-400">Registrado em {formatDate(source.visit_at)}</p>}
        </section>)}</div>
        <section className="crm-card"><div className="mb-4 flex items-center justify-between gap-2"><h3 className="font-semibold text-[#173052]">Oportunidades em análise</h3><Button variant="ghost" size="sm" onClick={() => setTab("opportunities")}>Ver todas</Button></div>{suggestionCards(2)}{openDeals.length > 0 && <p className="mt-4 text-sm text-slate-500">{openDeals.length} oportunidade(s) no funil · {currency(openDeals.reduce((total, item) => total + Number(item.amount), 0))}</p>}</section>
        <section className="crm-card"><div className="mb-5 flex items-center justify-between gap-2"><h3 className="font-semibold text-[#173052]">Últimas interações</h3><Button variant="ghost" size="sm" onClick={() => setTab("history")}>Ver histórico</Button></div>{timelineList(3)}</section>
      </>}
      {tab === "history" && <section className="crm-card"><h3 className="mb-6 font-semibold text-[#173052]">Toda a história deste relacionamento</h3>{timelineList()}</section>}
      {tab === "opportunities" && <>
        <section className="crm-card"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-[#173052]">Negócios no funil</h3>{editable && <Button variant="outline" size="sm" onClick={onNewOpportunity}><Plus className="size-4" /> Criar oportunidade</Button>}</div>
          {opportunities.length ? <div className="grid gap-3 sm:grid-cols-2">{opportunities.map((item) => <button key={item.id} onClick={() => onOpportunityDetail(item.id)} className="rounded-xl bg-slate-50 p-4 text-left hover:bg-slate-100"><Badge variant="secondary">{item.is_draft ? "Rascunho" : item.stage}</Badge><p className="mt-2 font-medium">{item.title}</p><p className="mt-2 text-sm text-slate-500">{item.amount ? currency(item.amount) : "Valor a definir"} · {item.assigned_to || "Sem responsável"}</p></button>)}</div> : <p className="text-sm text-slate-500">Nenhum negócio no funil para esta empresa.</p>}
        </section><section className="crm-card"><h3 className="font-semibold text-[#173052]">Ideias das reuniões</h3><p className="mb-4 mt-1 text-sm text-slate-500">Sugestões em análise. Revise antes de criar um negócio.</p>{suggestionCards()}</section>
      </>}
      {tab === "meetings" && <>
        <p className="text-sm text-slate-500">Cada reunião tem sua própria ata. Novos registros preservam todo o histórico.</p>
        {withoutMinutes.length > 0 && <section className="crm-card bg-[#faf6ed]"><h3 className="mb-3 font-semibold">Reuniões sem ata</h3>{withoutMinutes.map((meeting) => <div key={meeting.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{meeting.title}</p><p className="mt-1 text-xs text-slate-500">{formatDate(meeting.due_at, true)}</p></div>{editable && <Button size="sm" variant="outline" onClick={() => onRegister(meeting)}>Adicionar ata</Button>}</div>)}</section>}
        {sorted.length ? sorted.map((item) => <article key={item.id} className="crm-card">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-[#806738]">{formatDate(item.visit_at, item.business_details.visit_time_known !== "false")}</p><h3 className="mt-2 font-semibold text-[#173052]">{item.business_details.source_meeting_title || item.visit_kind}</h3></div><Badge variant="secondary">{item.status === "draft" ? "Rascunho" : item.status === "archived" ? "Arquivada" : "Ata salva"}</Badge></div>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">{item.summary || "Resumo ainda não preenchido."}</p>
          {item.next_action && <div className="mt-4 rounded-xl bg-[#faf6ed] p-3"><p className="text-xs font-semibold text-[#806738]">Próximo passo registrado</p><p className="mt-1 text-sm">{item.next_action}</p>{item.next_due_at && <p className="mt-1 text-xs text-slate-500">{formatDate(item.next_due_at, true)}</p>}</div>}
          {item.business_details.raw_notes && <details className="mt-4 text-sm"><summary className="cursor-pointer text-slate-500">Texto original da reunião</summary><p className="mt-3 whitespace-pre-wrap break-words leading-6 text-slate-600">{item.business_details.raw_notes}</p></details>}
          <div className="mt-4 flex flex-wrap gap-2">{item.business_details.attachment_path && <Button variant="outline" size="sm" onClick={() => onOpenAttachment(item.business_details.attachment_path)}><FileText className="size-4" /> Abrir ata original</Button>}{editable && <Button variant="ghost" size="sm" onClick={() => onEditDiagnostic(item)}>Editar ata</Button>}{editable && item.status === "completed" && <Button variant="ghost" size="sm" onClick={() => onArchiveDiagnostic(item)}>Arquivar</Button>}</div>
        </article>) : <section className="crm-card py-10 text-center"><FileText className="mx-auto size-8 text-[#b79558]" /><h3 className="mt-4 font-semibold">A primeira reunião começa este histórico</h3><p className="mt-2 text-sm text-slate-500">Use “Registrar reunião” para anexar uma ata ou escrever um resumo.</p></section>}
      </>}
      {tab === "connections" && <section className="crm-card"><h3 className="flex items-center gap-2 font-semibold"><Users className="size-5" /> Pessoas e conexões</h3><p className="mt-1 text-sm text-slate-500">Contatos vinculados a esta empresa. Parcerias sugeridas ficam em Oportunidades.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{contacts.map((person) => <div key={person.id} className="rounded-xl bg-slate-50 p-4"><p className="font-medium">{person.name}</p><p className="mt-1 text-sm text-slate-500">{person.title || "Cargo a informar"}</p><p className="mt-2 break-words text-sm text-slate-600">{person.email || person.whatsapp || person.phone || "Contato a informar"}</p></div>)}</div>{!contacts.length && <p className="mt-4 text-sm text-slate-500">Nenhum contato vinculado.</p>}</section>}
      {tab === "data" && <section className="crm-card"><h3 className="mb-5 font-semibold">Dados e contexto da empresa</h3><dl className="grid gap-5 sm:grid-cols-2">{[["Segmento", company.segment], ["Cidade", company.city], ["Telefone", company.phone], ["Observações", company.observations], ...Object.entries(details).filter(([key]) => key in businessLabels).map(([key, value]) => [businessLabels[key], value])].filter(([, value]) => value).map(([label, value], index) => <div key={String(label) + index}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{value}</dd></div>)}</dl><div className="mt-5 flex flex-wrap gap-4">{[["Site", company.website], ["Instagram", company.instagram]].map(([label, url]) => safeExternalUrl(url) && <a key={label} href={safeExternalUrl(url)!} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4">{label} <ArrowUpRight className="inline size-4" /></a>)}</div></section>}
    </div>
  </div>;
}
