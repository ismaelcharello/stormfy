import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanyProfile } from "@/components/crm/company-profile";
import { company, contact, diagnostic, opportunity, task } from "./fixtures";

it("keeps every meeting, original attachment and a single unified timeline; reviews an idea before creating a deal", async () => {
  const onCreateOpportunity = vi.fn(); const onOpenAttachment = vi.fn();
  const user = userEvent.setup();
  render(<CompanyProfile company={company} contacts={[contact]} diagnostics={[diagnostic, { ...diagnostic, id: "second", visit_at: "2026-09-29T12:00:00Z", summary: "Segunda reunião de acompanhamento", business_details: {}, pains: [], desires: [], ideas: [] }]} opportunities={[opportunity]} tasks={[task]} interactions={[]} canEdit onRegister={vi.fn()} onEditDiagnostic={vi.fn()} onArchiveDiagnostic={vi.fn()} onCreateOpportunity={onCreateOpportunity} onNewOpportunity={vi.fn()} onOpportunityDetail={vi.fn()} onAddTask={vi.fn()} onAddInteraction={vi.fn()} onEditCompany={vi.fn()} onOpenAttachment={onOpenAttachment} />);
  expect(screen.getByText("Baixa visibilidade")).toBeTruthy();
  await user.click(screen.getByRole("tab", { name: "Reuniões e atas" }));
  const panel = screen.getByRole("tabpanel");
  expect(within(panel).getAllByText("Ata salva")).toHaveLength(2);
  await user.click(within(panel).getByRole("button", { name: "Abrir ata original" }));
  expect(onOpenAttachment).toHaveBeenCalledWith(diagnostic.business_details.attachment_path);
  await user.click(screen.getByRole("tab", { name: "Histórico" }));
  expect(within(screen.getByRole("tabpanel")).getAllByText(diagnostic.summary)).toHaveLength(1);
  await user.click(screen.getByRole("tab", { name: "Oportunidades" }));
  await user.click(screen.getByRole("button", { name: /Revisar e criar oportunidade/ }));
  expect(onCreateOpportunity).toHaveBeenCalledWith(diagnostic, diagnostic.ideas[0]);
});
