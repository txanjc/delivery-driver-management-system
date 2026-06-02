import { ContentCard, PageHeader } from "../_components/admin-ui";

export default function AdminReportsPage() {
  return (
    <section className="space-y-8">
      <PageHeader
        description="Operational, delivery, fleet, driver, and financial reports will be available here."
        title="Reports"
      />

      <ContentCard title="Reporting Workspace">
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-sm text-slate-600">
          Reporting dashboards and export tools are planned for a future phase.
        </div>
      </ContentCard>
    </section>
  );
}
