import { describe, expect, it } from "vitest";
import { companyKnowledge, isPendingTask, opportunityContext } from "@/lib/crm-insights";
import { meetingDraftKey, readMeetingDraft } from "@/lib/meeting-draft";
import { diagnostic, opportunity, task } from "./fixtures";

describe("Historical context", () => {
  it("keeps prior company details when a later meeting is sparse, ignoring drafts and archived minutes", () => {
    const latest = { ...diagnostic, id: "latest", visit_at: "2026-09-29T12:00:00Z", summary: "Nova conversa", business_details: { history: "", audience: "Empresários" }, pains: [], desires: [], ideas: [] };
    const knowledge = companyKnowledge([diagnostic, latest, { ...latest, status: "draft", business_details: { history: "Not reviewed" } }]);
    expect(knowledge.current?.id).toBe("latest");
    expect(knowledge.details.history).toBe(diagnostic.business_details.history);
    expect(knowledge.details.audience).toBe("Empresários");
    expect(knowledge.painsSource?.id).toBe(diagnostic.id);
    expect(knowledge.ideas).toHaveLength(1);
  });
  it("does not count cancelled, archived or draft meetings as pending", () => {
    expect(isPendingTask(task)).toBe(true);
    expect(isPendingTask({ ...task, archived_at: "2026-09-26" })).toBe(false);
    expect(isPendingTask({ ...task, meeting_status: "Rascunho" })).toBe(false);
    expect(isPendingTask({ ...task, status: "Cancelada" })).toBe(false);
  });
  it("uses a linked pending task as the next step and does not invent a last interaction", () => {
    expect(opportunityContext(opportunity, [task], []).nextStep).toBe(task.title);
    expect(opportunityContext(opportunity, [], []).nextStep).toBe("Confirmar escopo");
    expect(opportunityContext(opportunity, [], []).lastInteraction).toBeUndefined();
  });
  it("separates drafts by user and workspace and safely ignores corrupt browser storage", () => {
    expect(meetingDraftKey("workspace:a", "new")).not.toBe(meetingDraftKey("workspace:b", "new"));
    localStorage.setItem("broken", "{invalid");
    expect(readMeetingDraft(localStorage, "broken")).toBeNull();
    localStorage.setItem("broken", JSON.stringify({ form: { pains: "bad" } }));
    expect(readMeetingDraft(localStorage, "broken")).toBeNull();
  });
});
