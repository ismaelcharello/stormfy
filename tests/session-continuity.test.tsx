import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

const backend = vi.hoisted(() => ({
  listener: null as null | ((event: string, session: Session) => void),
  fetchData: vi.fn(),
  session: { access_token: "synthetic-old-token", refresh_token: "synthetic-refresh", token_type: "bearer", expires_in: 3600, user: { id: "user-qa", email: "qa@example.invalid", app_metadata: {}, user_metadata: { full_name: "QA" }, aud: "authenticated", created_at: "2026-01-01" } } as Session,
}));
vi.mock("@supabase/ssr", () => {
  const client = {
    rpc: () => Promise.resolve({ data: false, error: null }),
    from: (table: string) => {
      const chain = {
        select: () => chain, eq: () => chain,
        maybeSingle: () => Promise.resolve({ data: { workspace_id: "workspace-qa", role: "member" }, error: null }),
        single: () => Promise.resolve({ data: table === "workspaces" ? { id: "workspace-qa", name: "QA", owner_id: "user-qa" } : {}, error: null }),
      }; return chain;
    },
    auth: {
      getSession: () => Promise.resolve({ data: { session: backend.session } }),
      onAuthStateChange: (listener: typeof backend.listener) => { backend.listener = listener; return { data: { subscription: { unsubscribe() {} } } }; },
    },
  };
  return { createBrowserClient: () => client };
});
vi.mock("@/lib/crm-repository", () => ({ fetchCrmData: backend.fetchData, fetchTeamAdminData: vi.fn() }));
import CrmApp from "@/app/crm-app";
import { company, contact } from "./fixtures";

it("keeps the open meeting and its text when the same user's session is refreshed", async () => {
  backend.fetchData.mockResolvedValue({ companies: [company], contacts: [contact], opportunities: [], tasks: [], interactions: [], columns: [], activities: [], diagnostics: [], members: [] });
  render(<CrmApp supabaseUrl="https://synthetic.supabase.invalid" supabasePublishableKey="synthetic-publishable-key" />);
  await screen.findByRole("heading", { name: "Seu foco hoje" });
  const user = userEvent.setup();
  await user.click(screen.getAllByRole("button", { name: /^Registrar reunião$/ })[0]);
  await user.type(screen.getByLabelText("Texto ou transcrição (opcional)"), "Texto preservado ao voltar ao aplicativo.");
  const originalLoads = backend.fetchData.mock.calls.length;
  await act(async () => backend.listener?.("TOKEN_REFRESHED", { ...backend.session, access_token: "synthetic-new-token", user: { ...backend.session.user } }));
  await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
  expect((screen.getByLabelText("Texto ou transcrição (opcional)") as HTMLTextAreaElement).value).toBe("Texto preservado ao voltar ao aplicativo.");
  expect(backend.fetchData.mock.calls.length).toBe(originalLoads);
});
