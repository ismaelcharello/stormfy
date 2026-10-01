import type { CompanyDiagnostic, Interaction, Opportunity, Task } from "./crm-types";

export function latestDate(values: (string | null | undefined)[]) {
  return values.filter((value): value is string => Boolean(value) && Number.isFinite(new Date(value!).getTime()))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

export function isPendingTask(task: Task) {
  return !task.archived_at && task.status === "Pendente" && !["Rascunho", "Cancelada"].includes(task.meeting_status || "");
}

/** Sparse minutes enrich the profile; they never erase earlier meeting records. */
export function companyKnowledge(diagnostics: CompanyDiagnostic[]) {
  const completed = diagnostics.filter((item) => item.status === "completed")
    .sort((a, b) => new Date(b.visit_at).getTime() - new Date(a.visit_at).getTime());
  const details: Record<string, string> = {};
  for (const item of [...completed].reverse()) {
    for (const [key, value] of Object.entries(item.business_details || {})) {
      if (value.trim()) details[key] = value;
    }
  }
  return {
    current: completed[0], details,
    potential: completed.find((item) => item.potential)?.potential,
    responsible: completed.find((item) => item.responsible)?.responsible,
    contactId: completed.find((item) => item.contact_id)?.contact_id,
    painsSource: completed.find((item) => item.pains.length),
    desiresSource: completed.find((item) => item.desires.length),
    ideas: completed.flatMap((meeting) => meeting.ideas.map((idea) => ({ meeting, idea }))),
  };
}

export function opportunityContext(opportunity: Opportunity, tasks: Task[], interactions: Interaction[]) {
  const relatedTasks = tasks.filter((task) => task.opportunity_id === opportunity.id && !task.archived_at);
  const next = relatedTasks.filter(isPendingTask).sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0];
  const lastInteraction = latestDate(interactions.filter((item) => item.opportunity_id === opportunity.id).map((item) => item.occurred_at));
  return {
    next,
    nextStep: next?.title || opportunity.next_step || opportunity.notes?.match(/Próximo passo:\s*([^\n]+)/i)?.[1] || "Próximo passo a definir",
    lastInteraction,
    lastMovement: latestDate([lastInteraction, opportunity.updated_at, opportunity.created_at, ...relatedTasks.map((item) => item.completed_at)])!,
  };
}

export function dayKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
