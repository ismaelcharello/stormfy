import CrmApp from "../crm-app";

export const dynamic = "force-dynamic";

export default function AppPage() {
  return <CrmApp
    supabaseUrl={process.env.SUPABASE_URL}
    supabasePublishableKey={process.env.SUPABASE_PUBLISHABLE_KEY}
    aiEnabled={Boolean(process.env.OPENAI_API_KEY)}
  />;
}
