import { lazy, Suspense, useState } from "react";

import { CategoryChart } from "../components/dashboard/CategoryChart";
import { ElementTable } from "../components/dashboard/ElementTable";
import { KpiCards } from "../components/dashboard/KpiCards";
import { LevelChart } from "../components/dashboard/LevelChart";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { Tabs, type DashboardTab } from "../components/ui/Tabs";
import { useElementMap } from "../hooks/useElementMap";
import { useViewerConfig } from "../hooks/useViewerConfig";

const SpeckleViewer = lazy(() => import("../components/dashboard/SpeckleViewer"));

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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const {
    data: viewerConfig,
    isLoading: configLoading,
    isError: configError,
    error: configErr,
    refetch: refetchConfig,
  } = useViewerConfig();
  const { data: elementMap } = useElementMap();

  const handleTableRowClick = (elementId: string) => {
    const applicationId = elementMap?.[elementId] ?? elementId;
    setSelectedIds([applicationId]);
  };

  const handleViewerClick = (applicationId: string) => {
    setSelectedIds([applicationId]);
  };

  const selectedId = selectedIds[0] ?? null;

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto xl:grid-cols-2 xl:overflow-hidden">
      <div className="min-h-[360px] xl:h-full xl:min-h-0 xl:overflow-hidden">
        {configLoading ? (
          <div className="flex h-full min-h-[360px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
            <LoadingSpinner label="Preparando visor…" />
          </div>
        ) : configError || !viewerConfig ? (
          <div className="flex h-full min-h-[360px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-4">
            <ErrorMessage
              message={
                configErr instanceof Error
                  ? configErr.message
                  : "No se pudo cargar la config de Speckle"
              }
              onRetry={() => void refetchConfig()}
            />
          </div>
        ) : !viewerConfig.stream_id ? (
          <div className="flex h-full min-h-[360px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Configura <code className="mx-1">SPECKLE_STREAM_ID</code> en el
            servidor para cargar el modelo 3D.
          </div>
        ) : !viewerConfig.commit_id ? (
          <div className="flex h-full min-h-[360px] items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No hay commits en el modelo{" "}
            <code className="mx-1">{viewerConfig.branch_name}</code>. Revisa{" "}
            <code className="mx-1">SPECKLE_BRANCH_NAME</code>.
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full min-h-[360px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                <LoadingSpinner label="Cargando visor 3D…" />
              </div>
            }
          >
            <SpeckleViewer
              serverUrl={viewerConfig.server_url}
              streamId={viewerConfig.stream_id}
              commitId={viewerConfig.commit_id}
              authToken={viewerConfig.token}
              selectedElementIds={selectedIds}
              onElementClick={handleViewerClick}
            />
          </Suspense>
        )}
      </div>
      <div className="min-h-[360px] xl:h-full xl:min-h-0 xl:overflow-hidden">
        <ElementTable
          selectedElementId={selectedId}
          onRowClick={handleTableRowClick}
        />
      </div>
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
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Tabs
        tabs={DASHBOARD_TABS}
        defaultTabId="overview"
        className="min-h-0 flex-1"
        panelClassName="pt-3"
      />
    </div>
  );
}
