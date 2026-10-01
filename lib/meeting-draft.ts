import { z } from "zod";

const text = z.string();
export const meetingDraftSchema = z.object({
  form: z.object({
    company_id: text, contact_id: text, status: z.enum(["draft", "completed", "archived"]),
    relationship_status: text, potential: text, responsible: text, visit_at: text, visit_kind: text,
    attendees: text, location: text, summary: text, business_details: z.record(text),
    pains: z.array(z.object({ text, priority: z.enum(["Baixa", "Média", "Alta"]) })),
    desires: z.array(text),
    ideas: z.array(z.object({ title: text, description: text, type: text, potential: z.enum(["", "Baixo", "Médio", "Alto"]), stage: text, amount: text, assigned_to: text, next_step: text, due_at: text, notes: text })),
    next_action: text, next_kind: text, next_due_at: text, next_assigned_to: text,
    next_priority: text, next_notes: text, schedule_task: z.boolean(),
  }),
  rawNotes: text, rawNotesHtml: text.optional(), summaryHtml: text.optional(), pasteMode: z.boolean(), savedAt: text, fileName: text.optional(),
});

export type MeetingDraft = z.infer<typeof meetingDraftSchema>;
export const meetingDraftKey = (scope: string, context: string) => "stormfy:meeting-draft:v2:" + scope + ":" + context;

export function readMeetingDraft(storage: Pick<Storage, "getItem">, key: string): MeetingDraft | null {
  const value = storage.getItem(key);
  if (!value) return null;
  try { const parsed = meetingDraftSchema.safeParse(JSON.parse(value)); return parsed.success ? parsed.data : null; }
  catch { return null; }
}

// Files stay in memory while this app is open; never imply localStorage stores a PDF.
export const pendingMeetingFiles = new Map<string, File>();
