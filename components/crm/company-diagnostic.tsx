"use client";

import { useRef, useState, type DragEvent } from "react";
import { Check, CheckCircle2, FileText, FileUp, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/crm/field";
import { stages, type Company, type CompanyDiagnostic, type Contact, type DiagnosticIdea, type DiagnosticPain, type Task } from "@/lib/crm-types";

export type DiagnosticForm = {
  company_id: string; contact_id: string; status: "draft" | "completed" | "archived";
  relationship_status: string; potential: string; responsible: string; visit_at: string; visit_kind: string;
  attendees: string; location: string; summary: string; business_details: Record<string, string>;
  pains: DiagnosticPain[]; desires: string[]; ideas: DiagnosticIdea[];
  next_action: string; next_kind: string; next_due_at: string; next_assigned_to: string;
  next_priority: string; next_notes: string; schedule_task: boolean;
};

const businessFields = [
  ["history","História da empresa"], ["years","Tempo de mercado"], ["region","Cidade e região"],
  ["segment","Segmento"], ["products","Produtos e serviços"], ["audience","Público-alvo"],
  ["model","Modelo de negócio"], ["differentials","Diferenciais"], ["acquisition","Como conquista clientes"],
  ["sales","Operação comercial"], ["channels","Canais de aquisição"], ["size","Porte e dados informados"],
  ["digital","Presença digital"], ["employees","Equipe, se informada"], ["other","Outros detalhes"],
] as const;
const ideaTypes = ["Consultoria","Treinamento","Palestra","Mentoria","Parceria","Indicação","Evento","Networking","Outro"];
const relationshipStatuses = ["Novo contato","Em relacionamento","Follow-up pendente","Oportunidade identificada","Reunião agendada","Cliente","Sem avanço"];
const nextKinds = ["Ligação","WhatsApp","E-mail","Reunião","Visita","Apresentação","Envio de material","Outro"];

function localDateTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}

export function emptyDiagnostic(companyId = "", contactId = "", responsible = ""): DiagnosticForm {
  return { company_id: companyId, contact_id: contactId, status: "draft", relationship_status: "Em relacionamento",
    potential: "", responsible, visit_at: localDateTime(), visit_kind: "Visita presencial", attendees: "",
    location: "", summary: "", business_details: {}, pains: [], desires: [], ideas: [], next_action: "",
    next_kind: "WhatsApp", next_due_at: "", next_assigned_to: responsible, next_priority: "Média",
    next_notes: "", schedule_task: false };
}

export function diagnosticFormFromRecord(item: CompanyDiagnostic): DiagnosticForm {
  return { company_id: item.company_id, contact_id: item.contact_id || "", status: item.status,
    relationship_status: item.relationship_status, potential: item.potential || "", responsible: item.responsible || "",
    visit_at: item.business_details?.visit_time_known === "false" ? localDateTime(item.visit_at).slice(0,10) : localDateTime(item.visit_at), visit_kind: item.visit_kind, attendees: item.attendees || "",
    location: item.location || "", summary: item.summary, business_details: item.business_details || {},
    pains: item.pains || [], desires: item.desires || [], ideas: item.ideas || [],
    next_action: item.next_action || "", next_kind: item.next_kind || "WhatsApp",
    next_due_at: item.next_due_at ? localDateTime(item.next_due_at) : "",
    next_assigned_to: item.next_assigned_to || "", next_priority: item.next_priority || "Média",
    next_notes: item.next_notes || "", schedule_task: Boolean(item.task_id) };
}

function diagnosticFormFromMeeting(meeting: Task, responsible: string): DiagnosticForm {
  const form = emptyDiagnostic(meeting.company_id || "", meeting.contact_id || "", meeting.assigned_to || responsible);
  return { ...form, visit_at: localDateTime(meeting.due_at), visit_kind: "Reunião",
    attendees: meeting.participants?.join(", ") || "", location: meeting.location || "",
    business_details: { source_meeting_id: meeting.id, source_meeting_title: meeting.title, visit_time_known: "true" } };
}

const blankIdea = (): DiagnosticIdea => ({ title: "", description: "", type: "Parceria", potential: "Médio",
  stage: "Novo lead", amount: "", assigned_to: "", next_step: "", due_at: "", notes: "" });

export function CompanyDiagnosticEditor({ initial, meeting, companyId, contactId, companies, contacts, responsible, authToken, aiEnabled,
  onSave, onQuickCreate, onClose }: {
  initial?: CompanyDiagnostic | null; meeting?: Task | null; companyId?: string; contactId?: string; companies: Company[];
  contacts: Contact[]; responsible: string; authToken?: string; aiEnabled?: boolean; onSave: (form: DiagnosticForm, id?: string, pdf?: File | null) => Promise<string | null>;
  onQuickCreate: (name: string, contactName: string, phone: string) => Promise<{ companyId: string; contactId: string } | null>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DiagnosticForm>(() => initial ? diagnosticFormFromRecord(initial) : meeting ? diagnosticFormFromMeeting(meeting, responsible) : emptyDiagnostic(companyId, contactId, responsible));
  const [recordId, setRecordId] = useState(initial?.id);
  const [pasteMode, setPasteMode] = useState(!initial);
  const [rawNotes, setRawNotes] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [desireInput, setDesireInput] = useState("");
  const [quickName, setQuickName] = useState("");
  const [quickContact, setQuickContact] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const availableContacts = contacts.filter((item) => item.company_id === form.company_id);
  const fileInput = useRef<HTMLInputElement>(null);
  const change = (partial: Partial<DiagnosticForm>) => { setForm((current) => ({ ...current, ...partial })); setDirty(true); setError(""); };
  const changeBusiness = (key: string, value: string) => change({ business_details: { ...form.business_details, [key]: value } });
  const close = () => {
    if (busy) return;
    if (dirty && !window.confirm("Sair sem salvar as alterações deste diagnóstico?")) return;
    onClose();
  };
  const save = async (status: "draft" | "completed", keepOpen = false) => {
    if (!form.company_id) { setError("Selecione a empresa."); return; }
    if (status === "completed" && !form.summary.trim()) { setError("Escreva um breve resumo da conversa."); return; }
    if (status === "completed" && form.schedule_task && (!form.next_action.trim() || !form.next_due_at)) {
      setError("Preencha a ação e a data do próximo contato."); return;
    }
    setBusy(true); setError("");
    try {
      const id = await onSave({ ...form, status, ideas: form.ideas.filter((idea) => idea.title.trim()) }, recordId, pdf);
      if (id) { setRecordId(id); setDirty(false); if (!keepOpen) onClose(); }
      else setError("Não foi possível salvar. Confira os campos e tente novamente.");
    } catch {
      setError("Não foi possível salvar. Confira a data e tente novamente.");
    } finally {
      setBusy(false);
    }
  };
  const editPain = (index: number, partial: Partial<DiagnosticPain>) => change({ pains: form.pains.map((pain, i) => i === index ? { ...pain, ...partial } : pain) });
  const editIdea = (index: number, partial: Partial<DiagnosticIdea>) => change({ ideas: form.ideas.map((idea, i) => i === index ? { ...idea, ...partial } : idea) });
  const receiveFile = async (file?: File) => {
    if (!file) return;
    setError("");
    if (file.name.toLowerCase().endsWith(".pdf") && file.type === "application/pdf") {
      if (file.size > 8 * 1024 * 1024) { setError("O PDF deve ter até 8 MB."); return; }
      setPdf(file); setDirty(true); return;
    }
    if (/\.(txt|md)$/i.test(file.name) && file.size <= 100000) {
      const content = await file.text();
      if (content.length > 20000) { setError("O texto deve ter até 20 mil caracteres."); return; }
      setPdf(null); setRawNotes(content); setDirty(true); return;
    }
    setError("Escolha um arquivo PDF, TXT ou MD válido.");
  };
  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragActive(false); void receiveFile(event.dataTransfer.files?.[0]);
  };
  const organizeNotes = async () => {
    if (!form.company_id) { setError("Selecione a empresa antes de organizar o relato."); return; }
    if (rawNotes.trim().length < 30 && !pdf) { setError("Cole o relato ou selecione um PDF da reunião."); return; }
    setBusy(true); setError("");
    try {
      const body = new FormData();
      body.set("company_id", form.company_id); body.set("notes", rawNotes.trim()); body.set("meeting_date", form.visit_at.slice(0,10));
      if (pdf) body.set("file", pdf);
      const response = await fetch("/api/diagnostics/draft", { method: "POST", headers: { Authorization: `Bearer ${authToken || ""}` }, body });
      const result = await response.json() as { draft?: Partial<DiagnosticForm>; error?: string };
      if (!response.ok || !result.draft) throw new Error(result.error || "Não foi possível organizar o relato agora.");
      const draft = result.draft;
      setForm((current) => ({ ...current, summary: draft.summary || rawNotes.trim(), business_details: { ...current.business_details, ...draft.business_details }, pains: draft.pains || [], desires: draft.desires || [], ideas: draft.ideas || [], next_action: draft.next_action || "", next_kind: draft.next_kind || current.next_kind, next_due_at: draft.next_due_at || "", next_notes: draft.next_notes || "", schedule_task: Boolean(draft.schedule_task), relationship_status: draft.relationship_status || current.relationship_status }));
      setDirty(true); setPasteMode(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível organizar o relato agora."); }
    finally { setBusy(false); }
  };

  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent className="!inset-0 !top-0 !left-0 !max-h-[100dvh] !h-[100dvh] !w-full !max-w-none !translate-x-0 !translate-y-0 overflow-y-auto overscroll-contain !rounded-none border-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 sm:!inset-auto sm:!top-1/2 sm:!left-1/2 sm:!h-auto sm:!max-h-[92dvh] sm:!w-full sm:!max-w-3xl sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:!rounded-xl sm:border sm:p-6">
      <DialogHeader><DialogTitle>{initial ? "Editar ata da reunião" : meeting ? "Adicionar ata da reunião" : "Registrar reunião ou visita"}</DialogTitle>
        <DialogDescription>{pasteMode ? "Envie a ata em PDF ou cole a transcrição. Revise o resultado antes de salvar." : "Revise os pontos e a data sugerida de follow-up antes de salvar."}</DialogDescription></DialogHeader>
      <div className="space-y-5">
        {pasteMode ? <div className="space-y-4">
          {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <Field label="Empresa *"><NativeSelect value={form.company_id} onChange={(event) => change({ company_id: event.target.value, contact_id: "" })}><option value="">Selecione a empresa</option>{companies.filter((company) => !company.archived_at).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</NativeSelect></Field>
          {!form.company_id && <div className="rounded-lg border border-[#eadbb9] bg-[#faf6ed] p-3"><p className="mb-2 text-sm font-medium text-[#173052]">Empresa ainda não cadastrada?</p><div className="flex flex-wrap gap-2"><Input className="min-w-48 flex-1" value={quickName} onChange={(event) => setQuickName(event.target.value)} placeholder="Nome da empresa" aria-label="Nome da nova empresa" /><Button type="button" variant="outline" disabled={busy || !quickName.trim()} onClick={async () => { setBusy(true); try { const created = await onQuickCreate(quickName,quickContact,""); if (created) change({ company_id: created.companyId, contact_id: created.contactId }); } catch { setError("Não foi possível cadastrar a empresa."); } finally { setBusy(false); } }}>Cadastrar empresa</Button></div></div>}
          <Field label="Pessoa com quem conversou"><NativeSelect value={form.contact_id} onChange={(event) => change({ contact_id: event.target.value })}><option value="">Não informada</option>{availableContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</NativeSelect></Field>
          <Field label="Data da reunião"><Input type="date" value={form.visit_at.slice(0,10)} onChange={(event) => change({ visit_at: `${event.target.value}T10:00`, business_details: { ...form.business_details, visit_time_known: "false" } })} /></Field>
          <div role="button" tabIndex={0} onClick={() => fileInput.current?.click()} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInput.current?.click(); } }} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }} onDrop={dropFile}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-[#173052] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8864b] ${dragActive ? "border-[#173052] bg-[#f1eadc]" : pdf ? "border-emerald-300 bg-emerald-50/60" : "border-[#c5a56a] bg-[#faf6ed] hover:border-[#a8864b]"}`}>
            {pdf ? <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-emerald-700"><FileText className="size-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="size-4 text-emerald-600" /> Arquivo pronto para enviar</span><span className="block truncate text-sm text-slate-600">{pdf.name} · {(pdf.size / 1024 / 1024).toFixed(1)} MB</span></span><Button type="button" size="icon-sm" variant="ghost" aria-label="Remover arquivo" onClick={(event) => { event.stopPropagation(); setPdf(null); if (fileInput.current) fileInput.current.value = ""; }}><X className="size-4" /></Button></div> : <div className="flex flex-col items-center py-3 text-center sm:flex-row sm:text-left"><span className="mb-3 grid size-11 shrink-0 place-items-center rounded-xl bg-white sm:mb-0 sm:mr-3"><FileUp className="size-5" /></span><span><strong className="block">Arraste a ata para cá</strong><span className="block text-sm text-slate-600">ou clique para escolher PDF, TXT ou MD</span><span className="mt-1 block text-xs text-slate-500">PDF até 8 MB · texto até 20 mil caracteres</span></span></div>}
            <input ref={fileInput} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" className="sr-only" onChange={(event) => void receiveFile(event.target.files?.[0])} />
          </div>
          <Field label="Texto, ata ou transcrição"><Textarea rows={10} className="min-h-56 text-base" maxLength={20000} value={rawNotes} onChange={(event) => { setRawNotes(event.target.value); setDirty(true); }} placeholder="Cole o relato aqui. Se enviou um PDF, use este campo para acrescentar observações." /></Field>
          <p className="text-sm text-slate-600">Ao enviar, a IA preenche a ficha e sugere o próximo passo e a data do follow-up. Você poderá revisar tudo antes de salvar.</p>
          {!aiEnabled && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">A análise automática está temporariamente indisponível. O arquivo continua nesta tela.</p>}
          <div className="sticky bottom-[-1rem] z-10 -mx-4 flex flex-col gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:p-0"><Button type="button" variant="outline" onClick={() => { change({ summary: rawNotes.trim(), business_details: { ...form.business_details, raw_notes: rawNotes.trim() } }); setPasteMode(false); }}>Preencher manualmente</Button><Button type="button" disabled={busy || !aiEnabled || !form.company_id || (rawNotes.trim().length < 30 && !pdf)} onClick={() => void organizeNotes()} className="bg-[#173052] text-white"><Sparkles className="size-4" /> {busy ? "Lendo a ata e preenchendo..." : "Enviar e preencher automaticamente"}</Button></div>
        </div> : <>
        <div className="rounded-xl border border-[#eadbb9] bg-[#faf6ed] p-3 text-sm text-[#173052]">Revise e edite antes de salvar. A data e o horário sugeridos para o follow-up podem ser alterados; a tarefa só é criada ao confirmar.</div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        <section className="space-y-3"><h3 className="text-base font-semibold text-[#173052]">Empresa e encontro</h3><div className="grid gap-4 sm:grid-cols-2">
          <Field label="Empresa *"><NativeSelect value={form.company_id} onChange={(event) => change({ company_id: event.target.value, contact_id: "" })}><option value="">Selecione</option>{companies.filter((c) => !c.archived_at).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
          <Field label="Pessoa visitada"><NativeSelect value={form.contact_id} onChange={(event) => change({ contact_id: event.target.value })}><option value="">Não informada</option>{availableContacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.title ? ` · ${c.title}` : ""}</option>)}</NativeSelect></Field>
          <Field label="Cargo da pessoa"><Input value={form.business_details.contact_title || ""} onChange={(event) => changeBusiness("contact_title",event.target.value)} placeholder={contacts.find((item) => item.id === form.contact_id)?.title || "Se informado na conversa"} /></Field>
          {!form.company_id && <div className="space-y-3 rounded-lg border border-[#eadbb9] bg-[#faf6ed] p-4 sm:col-span-2"><p className="font-semibold text-[#173052]">Cadastro rápido de uma empresa nova</p><div className="grid gap-3 sm:grid-cols-3"><Field label="Nome da empresa"><Input value={quickName} onChange={(event) => setQuickName(event.target.value)} placeholder="Nome da empresa" /></Field><Field label="Nome da pessoa"><Input value={quickContact} onChange={(event) => setQuickContact(event.target.value)} placeholder="Pessoa visitada" /></Field><Field label="Telefone (opcional)"><Input type="tel" value={quickPhone} onChange={(event) => setQuickPhone(event.target.value)} /></Field></div><Button type="button" variant="outline" disabled={busy || !quickName.trim()} onClick={async () => { setBusy(true); try { const created = await onQuickCreate(quickName,quickContact,quickPhone); if (created) change({ company_id: created.companyId, contact_id: created.contactId }); } catch { setError("Não foi possível cadastrar a empresa. Tente novamente."); } finally { setBusy(false); } }}>Cadastrar e continuar</Button></div>}
          <Field label={form.business_details.visit_time_known === "false" ? "Data da visita" : "Data e hora"}><Input type={form.business_details.visit_time_known === "false" ? "date" : "datetime-local"} value={form.visit_at} onChange={(event) => change({ visit_at: event.target.value })} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700"><input type="checkbox" className="size-4 accent-[#173052]" checked={form.business_details.visit_time_known !== "false"} onChange={(event) => { const known = event.target.checked; change({ business_details: { ...form.business_details, visit_time_known: String(known) }, visit_at: known ? `${form.visit_at.slice(0,10)}T12:00` : form.visit_at.slice(0,10) }); }} /> Sei o horário do encontro</label>
          <Field label="Tipo de encontro"><NativeSelect value={form.visit_kind} onChange={(event) => change({ visit_kind: event.target.value })}>{["Visita presencial","Café","Reunião","Ligação","Evento","WhatsApp","Outro"].map((kind) => <option key={kind}>{kind}</option>)}</NativeSelect></Field>
          <Field label="Responsável"><Input value={form.responsible} onChange={(event) => change({ responsible: event.target.value })} placeholder="Nome da pessoa da equipe" /></Field>
          <Field label="Status do relacionamento"><NativeSelect value={form.relationship_status} onChange={(event) => change({ relationship_status: event.target.value })}>{relationshipStatuses.map((status) => <option key={status}>{status}</option>)}</NativeSelect></Field>
          <Field label="Potencial"><NativeSelect value={form.potential} onChange={(event) => change({ potential: event.target.value })}><option value="">Ainda não avaliado</option>{["Baixo","Médio","Alto"].map((value) => <option key={value}>{value}</option>)}</NativeSelect></Field>
        </div></section>
        <section className="space-y-3"><h3 className="text-base font-semibold text-[#173052]">Resumo da conversa</h3><div className="space-y-4">
          <Field label="Resumo da conversa *"><Textarea rows={7} value={form.summary} onChange={(event) => change({ summary: event.target.value })} placeholder="O que você descobriu sobre o negócio? O que foi combinado?" /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Pessoas presentes"><Input value={form.attendees} onChange={(event) => change({ attendees: event.target.value })} /></Field><Field label="Local"><Input value={form.location} onChange={(event) => change({ location: event.target.value })} /></Field></div>
        </div></section>
        <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-[#173052]">Detalhes da empresa (editar)</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">{businessFields.map(([key,label]) => <Field key={key} label={label}><Textarea rows={key === "history" || key === "sales" ? 3 : 2} value={form.business_details[key] || ""} onChange={(event) => changeBusiness(key,event.target.value)} placeholder="Registre apenas o que foi informado" /></Field>)}</div></details>
        <section className="space-y-3"><h3 className="text-base font-semibold text-[#173052]">Principais dores</h3><p className="text-sm text-slate-600">O que a empresa relatou como problema? Ajuste a prioridade.</p>
          {form.pains.map((pain,index) => <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_145px_auto]"><Field label={`Dor ${index + 1}`}><Input value={pain.text} onChange={(event) => editPain(index,{ text: event.target.value })} placeholder="Ex.: Ampliar a visibilidade em Curitiba" /></Field><Field label="Prioridade"><NativeSelect value={pain.priority} onChange={(event) => editPain(index,{ priority: event.target.value as DiagnosticPain["priority"] })}>{["Baixa","Média","Alta"].map((p) => <option key={p}>{p}</option>)}</NativeSelect></Field><Button type="button" size="icon" variant="ghost" className="self-end" aria-label={`Remover dor ${index + 1}`} onClick={() => change({ pains: form.pains.filter((_,i) => i !== index) })}><Trash2 className="size-4" /></Button></div>)}
          <Button type="button" variant="outline" onClick={() => change({ pains: [...form.pains,{ text: "", priority: "Média" }] })}><Plus className="size-4" /> Adicionar dor</Button>
        </section>
        <section className="space-y-3"><h3 className="text-base font-semibold text-[#173052]">Principais desejos</h3><p className="text-sm text-slate-600">Quais resultados o empresário deseja alcançar?</p>
          <div className="flex gap-2"><Input aria-label="Novo desejo" value={desireInput} onChange={(event) => setDesireInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (desireInput.trim()) { change({ desires: [...form.desires, desireInput.trim()] }); setDesireInput(""); } } }} placeholder="Ex.: Criar parcerias com empresas" /><Button type="button" variant="outline" onClick={() => { if (desireInput.trim()) { change({ desires: [...form.desires, desireInput.trim()] }); setDesireInput(""); } }}>Adicionar</Button></div>
          {form.desires.map((desire,index) => <div key={index} className="flex gap-2 rounded-lg border border-slate-200 p-2"><Input aria-label={`Desejo ${index + 1}`} value={desire} onChange={(event) => change({ desires: form.desires.map((item,i) => i === index ? event.target.value : item) })} /><Button type="button" size="icon" variant="ghost" aria-label={`Remover desejo ${index + 1}`} onClick={() => change({ desires: form.desires.filter((_,i) => i !== index) })}><Trash2 className="size-4" /></Button></div>)}
        </section>
        <section className="space-y-4"><h3 className="text-base font-semibold text-[#173052]">Oportunidades sugeridas</h3><p className="text-sm text-slate-600">Ideias identificadas na conversa; só as confirmadas devem ir para o funil.</p>
          {form.ideas.map((idea,index) => <div key={index} className="space-y-3 rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><strong className="text-sm text-[#173052]">Oportunidade {index + 1}</strong><Button type="button" size="sm" variant="ghost" onClick={() => change({ ideas: form.ideas.filter((_,i) => i !== index) })}>Remover</Button></div>
            <Field label="Título"><Input value={idea.title} onChange={(event) => editIdea(index,{ title: event.target.value })} placeholder="Ex.: Confraria com empresários" /></Field>
            <Field label="Descrição"><Textarea rows={2} value={idea.description} onChange={(event) => editIdea(index,{ description: event.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Tipo"><NativeSelect value={idea.type} onChange={(event) => editIdea(index,{ type: event.target.value })}>{ideaTypes.map((type) => <option key={type}>{type}</option>)}</NativeSelect></Field>
              <Field label="Potencial"><NativeSelect value={idea.potential} onChange={(event) => editIdea(index,{ potential: event.target.value as DiagnosticIdea["potential"] })}><option value="">Ainda não avaliado</option>{["Baixo","Médio","Alto"].map((p) => <option key={p}>{p}</option>)}</NativeSelect></Field>
              <Field label="Etapa sugerida"><NativeSelect value={idea.stage} onChange={(event) => editIdea(index,{ stage: event.target.value })}>{stages.map((s) => <option key={s}>{s}</option>)}</NativeSelect></Field>
              <Field label="Valor estimado (R$)"><Input type="number" min="0" step="0.01" value={idea.amount} onChange={(event) => editIdea(index,{ amount: event.target.value })} /></Field>
              <Field label="Responsável"><Input value={idea.assigned_to} onChange={(event) => editIdea(index,{ assigned_to: event.target.value })} /></Field>
              <Field label="Data prevista"><Input type="date" value={idea.due_at} onChange={(event) => editIdea(index,{ due_at: event.target.value })} /></Field></div>
            <Field label="Próximo passo da oportunidade"><Input value={idea.next_step} onChange={(event) => editIdea(index,{ next_step: event.target.value })} /></Field>
            <Field label="Observações"><Textarea rows={2} value={idea.notes} onChange={(event) => editIdea(index,{ notes: event.target.value })} /></Field>
          </div>)}
          <Button type="button" variant="outline" onClick={() => change({ ideas: [...form.ideas,blankIdea()] })}><Plus className="size-4" /> Adicionar oportunidade</Button>
        </section>
        <section className="space-y-4 rounded-xl border border-[#eadbb9] bg-[#faf6ed] p-4"><h3 className="text-base font-semibold text-[#173052]">Próximo passo e follow-up</h3><Field label="O que fazer agora?"><Textarea rows={3} value={form.next_action} onChange={(event) => change({ next_action: event.target.value })} placeholder="Ex.: Apresentar dois parceiros ao Vinicius" /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Tipo"><NativeSelect value={form.next_kind} onChange={(event) => change({ next_kind: event.target.value })}>{nextKinds.map((kind) => <option key={kind}>{kind}</option>)}</NativeSelect></Field>
            <Field label="Data e horário"><Input type="datetime-local" value={form.next_due_at} onChange={(event) => change({ next_due_at: event.target.value })} /></Field>
            <Field label="Responsável"><Input value={form.next_assigned_to} onChange={(event) => change({ next_assigned_to: event.target.value })} /></Field>
            <Field label="Prioridade"><NativeSelect value={form.next_priority} onChange={(event) => change({ next_priority: event.target.value })}>{["Baixa","Média","Alta"].map((p) => <option key={p}>{p}</option>)}</NativeSelect></Field></div>
          <Field label="Observações"><Textarea rows={2} value={form.next_notes} onChange={(event) => change({ next_notes: event.target.value })} /></Field>
          <label className="flex items-start gap-3 rounded-lg border border-[#eadbb9] bg-[#faf6ed] p-4 text-sm text-[#173052]"><input type="checkbox" checked={form.schedule_task} onChange={(event) => change({ schedule_task: event.target.checked })} className="mt-1 size-4 accent-[#173052]" /><span><strong>Agendar como follow-up</strong><span className="mt-1 block text-slate-600">A tarefa será criada ao concluir o diagnóstico e aparecerá no calendário de tarefas.</span></span></label>
        </section>
        <DialogFooter className="sticky bottom-[-1rem] z-10 -mx-4 flex gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void save("draft")}>Salvar rascunho</Button>
          <Button type="button" className="bg-[#173052] text-white" disabled={busy} onClick={() => void save("completed")}><Check className="size-4" /> {busy ? "Salvando..." : "Salvar ata da reunião"}</Button>
        </DialogFooter>
        </>}
      </div>
    </DialogContent>
  </Dialog>;
}
