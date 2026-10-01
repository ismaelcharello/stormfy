export type MeetingAction = {
  title: string;
  owner: string;
  due_date: string;
  status: "A fazer" | "Em andamento" | "Concluída";
  basis: "Combinado" | "Sugestão";
  priority: "Baixa" | "Média" | "Alta";
};

export const emptyMeetingAction = (): MeetingAction => ({ title: "", owner: "", due_date: "", status: "A fazer", basis: "Combinado", priority: "Média" });

export function parseActionPlan(value?: string): MeetingAction[] {
  if (!value) return [];
  try {
    const data = JSON.parse(value);
    if (!Array.isArray(data)) return [];
    return data.slice(0, 10).filter((item) => item && typeof item.title === "string").map((item) => ({
      title: item.title, owner: typeof item.owner === "string" ? item.owner : "", due_date: typeof item.due_date === "string" ? item.due_date : "",
      status: ["A fazer", "Em andamento", "Concluída"].includes(item.status) ? item.status : "A fazer",
      basis: item.basis === "Sugestão" ? "Sugestão" : "Combinado",
      priority: ["Baixa", "Média", "Alta"].includes(item.priority) ? item.priority : "Média",
    }));
  } catch { return []; }
}

export const serializeActionPlan = (items: MeetingAction[]) => JSON.stringify(items.filter((item) => item.title.trim()).slice(0, 10));
