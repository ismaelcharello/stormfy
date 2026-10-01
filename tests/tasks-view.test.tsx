import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TasksView } from "@/components/crm/views";
import type { Task } from "@/lib/crm-types";

const pendingTask: Task = {
  id: "task-pending",
  workspace_id: "workspace-1",
  title: "Retornar contato",
  kind: "WhatsApp",
  company_id: null,
  contact_id: null,
  opportunity_id: null,
  assigned_to: "Ismael",
  due_at: "2026-10-05T13:00:00.000Z",
  priority: "Alta",
  status: "Pendente",
  description: "Confirmar os próximos passos.",
  completed_at: null,
  created_at: "2026-10-01T12:00:00.000Z",
  updated_at: "2026-10-01T12:00:00.000Z",
  end_at: null,
  location: null,
  archived_at: null,
  meeting_status: null,
  participants: [],
  agenda: null,
  reminder_at: null,
};

const completedTask: Task = { ...pendingTask, id: "task-completed", title: "Enviar proposta", status: "Concluída", completed_at: "2026-10-01T15:00:00.000Z" };

it("opens, closes, checks and reopens activities", async () => {
  const user = userEvent.setup();
  const onComplete = vi.fn();
  const onReopen = vi.fn();
  render(<TasksView tasks={[pendingTask, completedTask]} contacts={new Map()} opportunities={new Map()} onCreate={vi.fn()} onComplete={onComplete} onRegisterResult={vi.fn()} onReopen={onReopen} onEdit={vi.fn()} onCancel={vi.fn()} statusFilter="" setStatusFilter={vi.fn()} />);

  expect(screen.queryByText("Confirmar os próximos passos.")).toBeNull();
  await user.click(screen.getAllByRole("button", { name: "Abrir" })[0]);
  expect(screen.getByText("Confirmar os próximos passos.")).toBeTruthy();
  await user.click(screen.getAllByRole("button", { name: "Fechar" })[0]);
  expect(screen.queryByText("Confirmar os próximos passos.")).toBeNull();

  await user.click(screen.getByRole("button", { name: "Concluir Retornar contato" }));
  expect(onComplete).toHaveBeenCalledWith("task-pending");
  await user.click(screen.getByRole("button", { name: "Voltar Enviar proposta para pendentes" }));
  expect(onReopen).toHaveBeenCalledWith(completedTask);
});
