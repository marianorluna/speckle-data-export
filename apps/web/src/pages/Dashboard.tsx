import { CategoryChart } from "../components/dashboard/CategoryChart";
import { ElementTable } from "../components/dashboard/ElementTable";
import { KpiCards } from "../components/dashboard/KpiCards";
import { LevelChart } from "../components/dashboard/LevelChart";
import { Tabs, type DashboardTab } from "../components/ui/Tabs";
import { useDashboardRealtime } from "../hooks/useDashboardRealtime";

function OverviewPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto lg:overflow-hidden">
      <div className="shrink-0">
        <KpiCards />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 lg:overflow-hidden">
        <div className="min-h-[280px] lg:h-full lg:min-h-0 lg:overflow-hidden">
          <CategoryChart />
        </div>
        <div className="min-h-[280px] lg:h-full lg:min-h-0 lg:overflow-hidden">
          <LevelChart />
        </div>
      </div>
    </div>
  );
}

function ElementsPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <ElementTable />
    </div>
  );
}

const DASHBOARD_TABS: DashboardTab[] = [
  {
    id: "overview",
    label: "Resumen",
    panel: <OverviewPanel />,
  },
  {
    id: "elements",
    label: "Elementos",
    panel: <ElementsPanel />,
  },
];

export function DashboardPage() {
  const { connected } = useDashboardRealtime();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {!connected ? (
        <div
          className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
          role="status"
        >
          Sin conexión en tiempo real. Los datos pueden estar desactualizados.
        </div>
      ) : null}

      <Tabs
        tabs={DASHBOARD_TABS}
        defaultTabId="overview"
        className="min-h-0 flex-1"
        panelClassName="pt-3"
      />
    </div>
  );
}
