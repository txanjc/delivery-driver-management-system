import { ContentCard, KpiCard, PageHeader } from "../_components/admin-ui";

const financeModules = [
  "Revenue",
  "Expenses",
  "Driver Payouts",
  "Vehicle Costs",
  "Profit & Loss",
  "Financial Reports",
];

export default function AdminFinancePage() {
  return (
    <section className="space-y-8">
      <PageHeader
        description="Finance planning for revenue, costs, payouts, profitability, and financial reporting."
        title="Finance"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          detail="Placeholder finance metric"
          label="Revenue"
          tone="green"
          value="$84.5k"
        />
        <KpiCard
          detail="Placeholder finance metric"
          label="Expenses"
          tone="orange"
          value="$51.2k"
        />
        <KpiCard
          detail="Placeholder finance metric"
          label="Net Profit"
          tone="blue"
          value="$33.3k"
        />
      </div>

      <ContentCard
        description="These modules are planned for the finance workflow."
        title="Future Finance Modules"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {financeModules.map((module) => (
            <div
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700"
              key={module}
            >
              {module}
            </div>
          ))}
        </div>
      </ContentCard>
    </section>
  );
}
