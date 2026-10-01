import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanyDiagnosticEditor, type DiagnosticForm } from "@/components/crm/company-diagnostic";
import { pendingMeetingFiles } from "@/lib/meeting-draft";
import { company, contact, diagnostic } from "./fixtures";

beforeEach(() => pendingMeetingFiles.clear());
function props(overrides = {}) {
  return { companyId: company.id, companies: [company], contacts: [contact], responsible: "Responsável QA", draftScope: "workspace-qa:user-qa", aiEnabled: false,
    onSave: vi.fn<(form: DiagnosticForm, id?: string, file?: File | null) => Promise<string | null>>().mockResolvedValue("saved-id"),
    onQuickCreate: vi.fn().mockResolvedValue({ companyId: company.id, contactId: contact.id }), onClose: vi.fn(), ...overrides };
}
function pdf() {
  const file = new File(["%PDF-1.4\n" + "synthetic fixture ".repeat(20)], "ata-teste.pdf", { type: "application/pdf" });
  Object.defineProperty(file, "slice", { value: () => ({ arrayBuffer: async () => new TextEncoder().encode("%PDF-").buffer }) });
  return file;
}
function drop(file: File) { fireEvent.drop(screen.getByRole("button", { name: /Arraste a ata/ }), { dataTransfer: { files: [file] } }); }

describe("Meeting entry", () => {
  it("loads and edits the saved original transcript without losing its attachment", async () => {
    const p = props({ initial: diagnostic }); const user = userEvent.setup(); render(<CompanyDiagnosticEditor {...p} />);
    await user.click(screen.getByRole("button", { name: "Alterar" }));
    const original = screen.getByLabelText("Texto ou transcrição (opcional)");
    expect((original as HTMLTextAreaElement).value).toBe(diagnostic.business_details.raw_notes);
    await user.clear(original); await user.type(original, "Transcrição revisada pelo usuário.");
    await user.click(screen.getByRole("button", { name: /^Continuar$/ }));
    await user.click(screen.getByRole("button", { name: "Salvar reunião" }));
    await waitFor(() => expect(p.onSave).toHaveBeenCalledOnce());
    expect(p.onSave.mock.calls[0][1]).toBe(diagnostic.id);
    expect(p.onSave.mock.calls[0][0].business_details).toMatchObject({ raw_notes: "Transcrição revisada pelo usuário.", attachment_path: diagnostic.business_details.attachment_path });
  });
  it("saves a simple meeting and an optional follow-up without advanced fields", async () => {
    const p = props(); const user = userEvent.setup(); render(<CompanyDiagnosticEditor {...p} />);
    await user.type(screen.getByLabelText("Texto ou transcrição (opcional)"), "Conversamos sobre uma parceria. Enviar apresentação.");
    await user.click(screen.getByRole("button", { name: /^Continuar$/ }));
    expect((screen.getByLabelText("Resumo da conversa *") as HTMLTextAreaElement).value).toContain("parceria");
    expect(screen.queryByLabelText("Cargo do contato")?.closest("details")?.open).toBe(false);
    await user.type(screen.getByLabelText("O que fazer depois? (opcional)"), "Enviar apresentação");
    fireEvent.change(screen.getByLabelText("Quando fazer o follow-up? (opcional)"), { target: { value: "2026-10-08T10:00" } });
    await user.click(screen.getByRole("button", { name: "Salvar reunião" }));
    await waitFor(() => expect(p.onSave).toHaveBeenCalledOnce());
    expect(p.onSave.mock.calls[0][0]).toMatchObject({ status: "completed", company_id: company.id, pains: [], desires: [], schedule_task: true, next_due_at: "2026-10-08T10:00" });
    expect(p.onClose).toHaveBeenCalledOnce();
    expect(localStorage.length).toBe(0);
  });
  it("creates the company within the meeting flow", async () => {
    const p = props({ companyId: undefined }); const user = userEvent.setup(); render(<CompanyDiagnosticEditor {...p} />);
    await user.click(screen.getByRole("button", { name: "Cadastrar uma nova empresa" }));
    await user.type(screen.getByLabelText("Nome da nova empresa *"), company.name);
    await user.type(screen.getByLabelText("Contato principal (opcional)"), contact.name);
    await user.click(screen.getByRole("button", { name: "Cadastrar empresa" }));
    await waitFor(() => expect(p.onQuickCreate).toHaveBeenCalledWith(company.name, contact.name, ""));
    expect((screen.getByLabelText("Empresa *") as unknown as HTMLSelectElement).value).toBe(company.id);
  });
  it("accepts drag and drop and preserves the PDF across the steps", async () => {
    const p = props(); const user = userEvent.setup(); render(<CompanyDiagnosticEditor {...p} />);
    const file = pdf(); drop(file);
    await screen.findByText("Ata selecionada");
    await user.click(screen.getByRole("button", { name: /^Continuar$/ }));
    await user.type(screen.getByLabelText("Resumo da conversa *"), "Resumo breve da reunião.");
    await user.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText(/ata-teste.pdf/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /^Continuar$/ }));
    await user.click(screen.getByRole("button", { name: "Salvar reunião" }));
    await waitFor(() => expect(p.onSave.mock.calls[0][2]).toBe(file));
  });
  it("restores text after reload and clearly asks to reattach the missing PDF", async () => {
    const p = props(); const user = userEvent.setup(); const view = render(<CompanyDiagnosticEditor {...p} />);
    drop(pdf()); await screen.findByText("Ata selecionada");
    await user.type(screen.getByLabelText("Texto ou transcrição (opcional)"), "Rascunho importante que deve continuar salvo.");
    await waitFor(() => expect(localStorage.length).toBe(1));
    view.unmount(); pendingMeetingFiles.clear(); // A full page reload loses in-memory File objects.
    render(<CompanyDiagnosticEditor {...p} />);
    expect(await screen.findByText(/Rascunho recuperado/)).toBeTruthy();
    expect(screen.getByText(/o navegador não restaurou o arquivo/)).toBeTruthy();
    expect((screen.getByLabelText("Texto ou transcrição (opcional)") as HTMLTextAreaElement).value).toContain("Rascunho importante");
    await user.click(screen.getByRole("button", { name: /^Continuar$/ }));
    expect(p.onSave).not.toHaveBeenCalled();
  });
  it("fills editable fields from simulated AI and saves the original notes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ draft: { summary: "Resumo sugerido pela IA", pains: diagnostic.pains, desires: diagnostic.desires, ideas: diagnostic.ideas, next_action: "Apresentar parceiros", next_due_at: "2026-10-08T10:00", next_notes: "Sugestão de data para revisão", schedule_task: true } }) }));
    const p = props({ aiEnabled: true, authToken: "synthetic-test-token" }); const user = userEvent.setup(); render(<CompanyDiagnosticEditor {...p} />);
    await user.type(screen.getByLabelText("Texto ou transcrição (opcional)"), "Notas sintéticas da reunião para testar o preenchimento automático.");
    await user.click(screen.getByRole("button", { name: /^Continuar$/ }));
    const summary = await screen.findByLabelText("Resumo da conversa *");
    expect((summary as HTMLTextAreaElement).value).toBe("Resumo sugerido pela IA");
    await user.clear(summary); await user.type(summary, "Resumo revisado pelo usuário");
    await user.click(screen.getByRole("button", { name: "Salvar reunião" }));
    await waitFor(() => expect(p.onSave).toHaveBeenCalledOnce());
    expect(p.onSave.mock.calls[0][0]).toMatchObject({ summary: "Resumo revisado pelo usuário", pains: diagnostic.pains, desires: diagnostic.desires, ideas: diagnostic.ideas });
    expect(p.onSave.mock.calls[0][0].business_details.raw_notes).toContain("Notas sintéticas");
  });
  it("keeps the PDF and enables manual save when simulated AI has no quota", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Análise indisponível." }) }));
    const p = props({ aiEnabled: true }); const user = userEvent.setup(); render(<CompanyDiagnosticEditor {...p} />);
    const file = pdf(); drop(file); await screen.findByText("Ata selecionada");
    await user.click(screen.getByRole("button", { name: /^Continuar$/ }));
    await screen.findByLabelText("Resumo da conversa *");
    expect(screen.getByRole("alert").textContent).toContain("Você pode salvar");
    await user.type(screen.getByLabelText("Resumo da conversa *"), "Resumo sem IA");
    await user.click(screen.getByRole("button", { name: "Salvar reunião" }));
    await waitFor(() => expect(p.onSave.mock.calls[0][2]).toBe(file));
  });
  it("keeps edits when server saving fails", async () => {
    const p = props({ onSave: vi.fn().mockResolvedValue(null) }); const user = userEvent.setup(); render(<CompanyDiagnosticEditor {...p} />);
    await user.click(screen.getByRole("button", { name: /^Continuar$/ }));
    await user.type(screen.getByLabelText("Resumo da conversa *"), "Não perder este resumo");
    await user.click(screen.getByRole("button", { name: "Salvar reunião" }));
    await screen.findByRole("alert");
    expect(p.onClose).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Resumo da conversa *") as HTMLTextAreaElement).value).toBe("Não perder este resumo");
    expect(localStorage.length).toBe(1);
  });
});
