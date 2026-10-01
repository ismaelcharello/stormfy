"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FileText, FileUp, LoaderCircle, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/crm/field";
import { meetingDraftKey, pendingMeetingFiles, readMeetingDraft } from "@/lib/meeting-draft";
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

export function CompanyDiagnosticEditor({ initial, meeting, companyId, contactId, companies, contacts, responsible, authToken, aiEnabled, draftScope,
  onSave, onQuickCreate, onClose }: {
  initial?: CompanyDiagnostic | null; meeting?: Task | null; companyId?: string; contactId?: string; companies: Company[];
  contacts: Contact[]; responsible: string; draftScope: string; authToken?: string; aiEnabled?: boolean; onSave: (form: DiagnosticForm, id?: string, pdf?: File | null) => Promise<string | null>;
  onQuickCreate: (name: string, contactName: string, phone: string) => Promise<{ companyId: string; contactId: string } | null>;
  onClose: () => void;
}) {
  const draftStorageKey = meetingDraftKey(draftScope, initial?.id || meeting?.id || `${companyId || "new"}:${contactId || "new"}`);
  const [form, setForm] = useState<DiagnosticForm>(() => initial ? diagnosticFormFromRecord(initial) : meeting ? diagnosticFormFromMeeting(meeting, responsible) : emptyDiagnostic(companyId, contactId, responsible));
  const [recordId, setRecordId] = useState(initial?.id);
  const [pasteMode, setPasteMode] = useState(!initial);
  const [rawNotes, setRawNotes] = useState(initial?.business_details.raw_notes || "");
  const [pdf, setPdf] = useState<File | null>(() => pendingMeetingFiles.get(draftStorageKey) || null);
  const [missingFile, setMissingFile] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [useAi, setUseAi] = useState(Boolean(aiEnabled));
  const [aiReviewed, setAiReviewed] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [desireInput, setDesireInput] = useState("");
  const [quickName, setQuickName] = useState("");
  const [quickContact, setQuickContact] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [recoveredDraft, setRecoveredDraft] = useState(false);
  const availableContacts = contacts.filter((item) => item.company_id === form.company_id);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const draft = readMeetingDraft(window.localStorage, draftStorageKey);
      if (draft) {
        // Hydrate browser-only draft data after mount, keeping SSR deterministic.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setForm(draft.form); setRawNotes(draft.rawNotes); setPasteMode(draft.pasteMode);
        setDirty(true); setRecoveredDraft(true);
        if (draft.fileName && !pendingMeetingFiles.has(draftStorageKey)) setMissingFile(draft.fileName);
      }
    } catch { setStorageError(true); }
    finally { setDraftReady(true); }
  }, [draftStorageKey]);
  useEffect(() => {
    if (!draftReady || !dirty) return;
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify({ form, rawNotes, pasteMode, fileName: pdf?.name || missingFile, savedAt: new Date().toISOString() }));
      // Reflect the result of writing to the external browser store.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [draftReady, dirty, form, rawNotes, pasteMode, pdf, missingFile, draftStorageKey]);
  useEffect(() => {
    if (pdf) pendingMeetingFiles.set(draftStorageKey, pdf);
    else pendingMeetingFiles.delete(draftStorageKey);
  }, [pdf, draftStorageKey]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty && (storageError || pdf)) { event.preventDefault(); }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, storageError, pdf]);
  const change = (partial: Partial<DiagnosticForm>) => { setForm((current) => ({ ...current, ...partial })); setDirty(true); setError(""); };
  const changeBusiness = (key: string, value: string) => change({ business_details: { ...form.business_details, [key]: value } });
  const close = () => {
    if (busy) return;
    if (dirty && storageError && !window.confirm("O navegador não conseguiu guardar o rascunho. Sair e descartar as alterações?")) return;
    onClose();
  };
  const save = async (status: "draft" | "completed") => {
    if (!form.company_id) { setError("Selecione a empresa."); return; }
    if (!form.visit_at || !Number.isFinite(new Date(form.visit_at).getTime())) { setError("Informe uma data válida para a reunião."); return; }
    if (missingFile) { setError("Reanexe o arquivo da ata ou escolha continuar sem ele."); return; }
    if (status === "completed" && !form.summary.trim()) { setError("Escreva um breve resumo da conversa."); return; }
    if (status === "completed" && form.schedule_task && (!form.next_action.trim() || !form.next_due_at)) {
      setError("Preencha a ação e a data do próximo contato."); return;
    }
    setBusy(true); setError("");
    try {
      const id = await onSave({ ...form, status, business_details: { ...form.business_details, raw_notes: rawNotes.trim() }, ideas: form.ideas.filter((idea) => idea.title.trim()) }, recordId, pdf);
      if (id) {
        setDirty(false); setRecordId(id); pendingMeetingFiles.delete(draftStorageKey);
        try { window.localStorage.removeItem(draftStorageKey); } catch { /* Saved on the server; storage cleanup must not report failure. */ }
        onClose();
      }
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
    if (!file || busy) return;
    setError("");
    if (file.name.toLowerCase().endsWith(".pdf") && (!file.type || file.type === "application/pdf")) {
      if (file.size > 8 * 1024 * 1024) { setError("O PDF deve ter até 8 MB."); return; }
      if (new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== "%PDF-") { setError("Este arquivo não é um PDF válido."); return; }
      setPdf(file.type ? file : new File([file], file.name, { type: "application/pdf" })); setMissingFile(""); setDirty(true); return;
    }
    if (/\.(txt|md)$/i.test(file.name) && file.size <= 100000) {
      const content = await file.text();
      if (content.length > 20000) { setError("O texto deve ter até 20 mil caracteres."); return; }
      setPdf(null); setMissingFile(""); setRawNotes(content); setDirty(true); return;
    }
    setError("Escolha um arquivo PDF, TXT ou MD válido.");
  };
  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault(); setDragActive(false);
    if (event.dataTransfer.files.length > 1) { setError("Envie uma ata por reunião para manter o histórico organizado."); return; }
    void receiveFile(event.dataTransfer.files?.[0]);
  };
  const organizeNotes = async () => {
    if (!form.company_id) { setError("Selecione a empresa antes de organizar o relato."); return; }
    if (rawNotes.trim().length < 30 && !pdf) { setError("Cole o relato ou selecione um PDF da reunião."); return; }
    setBusy(true); setError("");
    try {
      const body = new FormData();
      body.set("company_id", form.company_id); body.set("notes", rawNotes.trim()); body.set("meeting_date", form.visit_at.slice(0,10));
      if (pdf) body.set("file", pdf);
      const response = await fetch("/api/diagnostics/draft", { method: "POST", headers: { Authorization: `Bearer ${authToken || ""}` }, body, signal: AbortSignal.timeout(60000) });
      const result = await response.json() as { draft?: Partial<DiagnosticForm>; error?: string };
      if (!response.ok || !result.draft) throw new Error(result.error || "Não foi possível organizar o relato agora.");
      const draft = result.draft;
      setForm((current) => ({ ...current, summary: draft.summary || rawNotes.trim(), business_details: { ...current.business_details, ...draft.business_details }, pains: draft.pains || [], desires: draft.desires || [], ideas: draft.ideas || [], next_action: draft.next_action || "", next_kind: draft.next_kind || current.next_kind, next_due_at: draft.next_due_at || "", next_notes: draft.next_notes || "", schedule_task: Boolean(draft.schedule_task), relationship_status: draft.relationship_status || current.relationship_status }));
      setDirty(true); setAiReviewed(true); setPasteMode(false);
    } catch (cause) {
      setError((cause instanceof Error ? cause.message : "A análise não está disponível agora.") + " Você pode salvar o resumo e continuar; os detalhes são opcionais.");
      setForm((current) => ({ ...current, summary: current.summary || rawNotes.trim() }));
      setDirty(true); setPasteMode(false);
    }
    finally { setBusy(false); }
  };

  const continueMeeting = () => {
    if (!form.company_id) { setError("Selecione ou crie a empresa."); return; }
    if (!form.visit_at) { setError("Informe a data da reunião."); return; }
    if (missingFile) { setError("Reanexe o arquivo ou escolha continuar sem ele."); return; }
    if (useAi && aiEnabled && (pdf || rawNotes.trim().length >= 30)) { void organizeNotes(); return; }
    change({ summary: form.summary || rawNotes.trim() });
    setPasteMode(false);
  };
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
    <DialogContent className="!flex !flex-col !gap-0 !overflow-hidden !p-0 sm:!max-w-3xl" onPointerDownOutside={(event) => event.preventDefault()}>
      <DialogHeader className="shrink-0 border-b border-[#eee9df] px-5 pb-4 pt-6 text-left sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#947845]">Relacionamento em movimento</p>
        <DialogTitle className="pr-8 text-2xl text-[#173052]">{initial ? "Editar ata da reunião" : "Registrar reunião"}</DialogTitle>
        <DialogDescription>{pasteMode ? "Escolha a empresa e traga o que foi conversado." : "Revise o essencial. Os detalhes podem ficar para depois."}</DialogDescription>
        <ol className="mt-3 flex gap-5 text-xs font-medium" aria-label="Etapas do registro">
          <li aria-current={pasteMode ? "step" : undefined} className={pasteMode ? "text-[#173052]" : "text-slate-400"}>01 · Empresa e ata</li>
          <li aria-current={!pasteMode ? "step" : undefined} className={!pasteMode ? "text-[#173052]" : "text-slate-400"}>02 · Resumo e próximo passo</li>
        </ol>
      </DialogHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7">
        {recoveredDraft && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Rascunho recuperado. Continue de onde parou.</p>}
        {storageError && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">O navegador não conseguiu guardar este rascunho. Salve a ata antes de sair.</p>}
        {missingFile && <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><p>O texto foi recuperado, mas o navegador não restaurou o arquivo <strong>{missingFile}</strong>. Reanexe a ata antes de salvar.</p><div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setPasteMode(true)}>Reanexar ata</Button><Button variant="ghost" size="sm" onClick={() => { setMissingFile(""); setDirty(true); }}>Continuar sem arquivo</Button></div></div>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm leading-6 text-rose-800">{error}</p>}
        {pasteMode ? <div className="space-y-5">
          <Field label="Empresa *"><NativeSelect disabled={busy || Boolean(initial)} value={form.company_id} onChange={(event) => change({ company_id: event.target.value, contact_id: "" })}><option value="">Selecione a empresa</option>{companies.filter((company) => !company.archived_at || company.id === form.company_id).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</NativeSelect></Field>
          {!initial && <div><button type="button" className="text-sm font-medium text-[#806738] underline underline-offset-4" onClick={() => setQuickOpen(!quickOpen)}>Cadastrar uma nova empresa</button>
          {quickOpen && <div className="mt-3 space-y-3 rounded-xl bg-[#f8f5ed] p-4">
            <Field label="Nome da nova empresa *"><Input value={quickName} onChange={(event) => setQuickName(event.target.value)} /></Field>
            <Field label="Contato principal (opcional)"><Input value={quickContact} onChange={(event) => setQuickContact(event.target.value)} /></Field>
            <Field label="Telefone (opcional)"><Input type="tel" value={quickPhone} onChange={(event) => setQuickPhone(event.target.value)} /></Field>
            <Button type="button" variant="outline" disabled={busy || !quickName.trim()} onClick={async () => { setBusy(true); try { const created = await onQuickCreate(quickName, quickContact, quickPhone); if (created) { change({ company_id: created.companyId, contact_id: created.contactId }); setQuickOpen(false); } } catch { setError("Não foi possível cadastrar a empresa."); } finally { setBusy(false); } }}>Cadastrar empresa</Button>
          </div>}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contato (opcional)"><NativeSelect disabled={busy} value={form.contact_id} onChange={(event) => change({ contact_id: event.target.value })}><option value="">Não informado</option>{availableContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</NativeSelect></Field>
            <Field label="Data da reunião *"><Input disabled={busy} type="date" value={form.visit_at.slice(0,10)} onChange={(event) => change({ visit_at: event.target.value, business_details: { ...form.business_details, visit_time_known: "false" } })} /></Field>
          </div>
          <div role="button" tabIndex={0} onClick={() => { if (!busy) fileInput.current?.click(); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); fileInput.current?.click(); } }} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => { event.preventDefault(); setDragActive(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false); }} onDrop={dropFile}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-[#173052] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8864b] ${dragActive ? "border-[#173052] bg-[#f1eadc]" : pdf ? "border-emerald-300 bg-emerald-50/60" : "border-[#c5a56a] bg-[#faf6ed] hover:border-[#a8864b]"}`}>
            {pdf ? <div className="flex items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-emerald-700"><FileText className="size-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="size-4 text-emerald-600" /> Ata selecionada</span><span className="block truncate text-sm text-slate-600">{pdf.name} · {(pdf.size / 1024 / 1024).toFixed(1)} MB</span></span><Button type="button" size="icon-sm" variant="ghost" aria-label="Remover arquivo" onClick={(event) => { event.stopPropagation(); setPdf(null); setDirty(true); if (fileInput.current) fileInput.current.value = ""; }}><X className="size-4" /></Button></div> : <div className="flex flex-col items-center py-3 text-center sm:flex-row sm:text-left"><span className="mb-3 grid size-11 shrink-0 place-items-center rounded-xl bg-white sm:mb-0 sm:mr-3"><FileUp className="size-5" /></span><span><strong className="block">Arraste a ata para cá</strong><span className="block text-sm text-slate-600">ou clique para escolher PDF, TXT ou MD</span><span className="mt-1 block text-xs text-slate-500">PDF até 8 MB · texto até 20 mil caracteres</span></span></div>}
            <input ref={fileInput} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" className="sr-only" onChange={(event) => void receiveFile(event.target.files?.[0])} />
          </div>

          {initial?.business_details.attachment_name && !pdf && <p className="text-xs text-slate-500">Ata já salva: {initial.business_details.attachment_name}. Um novo PDF substituirá o anexo desta reunião.</p>}
          <Field label="Texto ou transcrição (opcional)"><Textarea disabled={busy} rows={5} maxLength={20000} value={rawNotes} onChange={(event) => { setRawNotes(event.target.value); setDirty(true); }} placeholder="Cole a ata, transcrição ou suas anotações. Você também pode continuar e escrever só um resumo." /></Field>
          {aiEnabled ? <label className="flex items-start gap-3 rounded-xl bg-[#f8f5ed] p-4 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-[#173052]" checked={useAi} disabled={busy} onChange={(event) => setUseAi(event.target.checked)} /><span><strong className="flex items-center gap-2 text-[#173052]"><Sparkles className="size-4" /> Preencher com IA ao continuar</strong><span className="mt-1 block leading-6 text-slate-500">A ata vira um resumo, dores, desejos e sugestões de próximos passos. Tudo fica editável.</span></span></label> : <p className="text-sm leading-6 text-slate-500">A análise automática está indisponível. Continue com um resumo e, se houver, o próximo passo. O PDF será anexado ao salvar.</p>}
        </div> : <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f4f1e9] p-3"><div className="min-w-0"><p className="font-medium text-[#173052]">{companies.find((item) => item.id === form.company_id)?.name}</p><p className="mt-1 text-xs text-slate-500">{form.visit_at.slice(0,10).split("-").reverse().join("/")}{pdf ? " · " + pdf.name : ""}</p></div><Button variant="ghost" size="sm" onClick={() => setPasteMode(true)}>Alterar</Button></div>
          {aiReviewed && <p role="status" className="rounded-xl bg-[#edf3f8] p-3 text-sm leading-6 text-[#173052]"><Sparkles className="mr-1 inline size-4" /> Preenchido pela IA. Confira os dados e as sugestões antes de salvar. Oportunidades sugeridas ainda não foram criadas no funil.</p>}
          <Field label="Resumo da conversa *"><Textarea rows={5} value={form.summary} onChange={(event) => change({ summary: event.target.value })} placeholder="O que foi conversado e combinado?" /></Field>
          <section className="space-y-4 rounded-2xl bg-[#f5eddd] p-4 sm:p-5">
            <h3 className="font-semibold text-[#173052]">Próximo passo</h3>
            <Field label="O que fazer depois? (opcional)"><Textarea rows={2} value={form.next_action} onChange={(event) => change({ next_action: event.target.value })} placeholder="Ex.: Apresentar dois parceiros estratégicos" /></Field>
            <Field label="Quando fazer o follow-up? (opcional)"><Input type="datetime-local" value={form.next_due_at} onChange={(event) => change({ next_due_at: event.target.value, schedule_task: Boolean(event.target.value) })} /></Field>
            {form.next_notes && <p className="text-xs leading-5 text-[#806738]">{form.next_notes}</p>}
            <label className="flex items-start gap-2 text-sm text-[#173052]"><input type="checkbox" className="mt-0.5 size-4 accent-[#173052]" checked={form.schedule_task} onChange={(event) => change({ schedule_task: event.target.checked })} /><span>Agendar este follow-up ao salvar a reunião</span></label>
            <details><summary className="cursor-pointer text-sm text-[#806738]">Responsável, tipo e prioridade</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Responsável pelo follow-up"><Input value={form.next_assigned_to} onChange={(event) => change({ next_assigned_to: event.target.value })} /></Field>
              <Field label="Tipo do próximo contato"><NativeSelect value={form.next_kind} onChange={(event) => change({ next_kind: event.target.value })}>{nextKinds.map((kind) => <option key={kind}>{kind}</option>)}</NativeSelect></Field>
              <Field label="Prioridade do follow-up"><NativeSelect value={form.next_priority} onChange={(event) => change({ next_priority: event.target.value })}>{["Baixa","Média","Alta"].map((value) => <option key={value}>{value}</option>)}</NativeSelect></Field>
              <Field label="Observações do follow-up"><Textarea value={form.next_notes} onChange={(event) => change({ next_notes: event.target.value })} /></Field>
            </div></details>
          </section>
          <p className="text-xs text-slate-500">Os campos abaixo são opcionais. Abra somente o que quiser revisar.</p>
        <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-[#173052]">Detalhes da empresa · opcional</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">{businessFields.map(([key,label]) => <Field key={key} label={label}><Textarea rows={key === "history" || key === "sales" ? 3 : 2} value={form.business_details[key] || ""} onChange={(event) => changeBusiness(key,event.target.value)} placeholder="Registre apenas o que foi informado" /></Field>)}</div></details>
        <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-[#173052]">Dores, desejos e oportunidades · opcional</summary><div className="mt-4 space-y-6">
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
        </div></details>

          <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer font-semibold text-[#173052]">Sobre o encontro e o relacionamento · opcional</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de encontro"><NativeSelect value={form.visit_kind} onChange={(event) => change({ visit_kind: event.target.value })}>{["Visita presencial","Café","Reunião","Ligação","Evento","WhatsApp","Outro"].map((kind) => <option key={kind}>{kind}</option>)}</NativeSelect></Field>
            <Field label="Responsável pela empresa"><Input value={form.responsible} onChange={(event) => change({ responsible: event.target.value })} /></Field>
            <Field label="Status do relacionamento"><NativeSelect value={form.relationship_status} onChange={(event) => change({ relationship_status: event.target.value })}>{relationshipStatuses.map((status) => <option key={status}>{status}</option>)}</NativeSelect></Field>
            <Field label="Potencial"><NativeSelect value={form.potential} onChange={(event) => change({ potential: event.target.value })}><option value="">Ainda não avaliado</option>{["Baixo","Médio","Alto"].map((value) => <option key={value}>{value}</option>)}</NativeSelect></Field>
            <Field label="Pessoas presentes"><Input value={form.attendees} onChange={(event) => change({ attendees: event.target.value })} /></Field>
            <Field label="Local"><Input value={form.location} onChange={(event) => change({ location: event.target.value })} /></Field>
            <Field label="Cargo do contato"><Input value={form.business_details.contact_title || ""} onChange={(event) => changeBusiness("contact_title", event.target.value)} /></Field>
            <Field label="Horário da reunião (opcional)"><Input type="time" value={form.business_details.visit_time_known === "false" ? "" : form.visit_at.slice(11,16)} onChange={(event) => change({ visit_at: event.target.value ? form.visit_at.slice(0,10) + "T" + event.target.value : form.visit_at.slice(0,10), business_details: { ...form.business_details, visit_time_known: String(Boolean(event.target.value)) } })} /></Field>
          </div></details>
        </div>}
      </div>
      <div className="shrink-0 border-t border-[#eee9df] bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-7">
        <p role="status" className="mb-3 text-xs text-slate-500">{busy ? "Aguarde, seu registro continua nesta tela." : dirty && !storageError ? "Rascunho guardado neste navegador." : "A reunião só entra no histórico quando você salvar."}</p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" disabled={busy} onClick={pasteMode ? close : () => setPasteMode(true)}>{pasteMode ? "Continuar depois" : <><ArrowLeft className="size-4" /> Voltar</>}</Button>
          {pasteMode ? <Button type="button" disabled={busy} onClick={continueMeeting}>{busy ? <><LoaderCircle className="size-4 animate-spin" /> Lendo a ata...</> : <>Continuar <ArrowRight className="size-4" /></>}</Button> : <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => void save("draft")}>Salvar rascunho</Button><Button type="button" disabled={busy} onClick={() => void save("completed")}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} {busy ? "Salvando..." : "Salvar reunião"}</Button></div>}
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
