import { ContentCard, PageHeader } from "../_components/admin-ui";

export default function AdminSettingsPage() {
  return (
    <section className="space-y-8">
      <PageHeader
        description="Account settings, portal preferences, role controls, and operational defaults will be managed here."
        title="Settings"
      />

      <ContentCard title="Settings Placeholder">
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-sm text-slate-600">
          Settings and preference controls are planned for a future Administrator flow.
        </div>
      </ContentCard>
    </section>
  );
}
