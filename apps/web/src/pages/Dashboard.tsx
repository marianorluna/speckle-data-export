import { lazy, Suspense, useState } from "react";

import { ChatFloatingWidget } from "../components/chat/ChatFloatingWidget";
import { CategoryChart } from "../components/dashboard/CategoryChart";
import { CompletenessChart } from "../components/dashboard/CompletenessChart";
import { ElementTable } from "../components/dashboard/ElementTable";
import { KpiCards } from "../components/dashboard/KpiCards";
import { LevelChart } from "../components/dashboard/LevelChart";
import { TopLevelsChart } from "../components/dashboard/TopLevelsChart";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { Tabs, type DashboardTab } from "../components/ui/Tabs";
import { useElementMap } from "../hooks/useElementMap";
import {
  hasActiveOverviewFilter,
  toggleCategoryFilter,
  toggleCompletenessFilter,
  toggleLevelFilter,
  type CompletenessBucket,
  type OverviewCrossFilter,
} from "../hooks/useOverviewCrossFilter";
import { useViewerConfig } from "../hooks/useViewerConfig";

const SpeckleViewer = lazy(() => import("../components/dashboard/SpeckleViewer"));

type OverviewPanelProps = {
  filters: OverviewCrossFilter;
  onFiltersChange: (filters: OverviewCrossFilter) => void;
};

function OverviewPanel({ filters, onFiltersChange }: OverviewPanelProps) {
  const hasLevelFilter = filters.level !== undefined;

  const handleSelectCategory = (category: string | null) => {
    if (category === null) {
      const next = { ...filters };
      delete next.category;
      onFiltersChange(next);
      return;
    }
    onFiltersChange(toggleCategoryFilter(filters, category));
  };

  const handleSelectLevel = (level: string | null) => {
    onFiltersChange(toggleLevelFilter(filters, level));
  };

  const handleSelectCompleteness = (bucket: CompletenessBucket | null) => {
    if (bucket === null) {
      const next = { ...filters };
      delete next.completeness;
      onFiltersChange(next);
      return;
    }
    onFiltersChange(toggleCompletenessFilter(filters, bucket));
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto lg:overflow-hidden">
      <div className="shrink-0">
        <KpiCards />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 lg:grid-rows-2 lg:overflow-hidden">
        <div className="min-h-[220px] lg:h-full lg:min-h-0 lg:overflow-hidden">
          <CategoryChart
            filters={filters}
            activeCategory={filters.category}
            onSelectCategory={handleSelectCategory}
          />
        </div>
        <div className="min-h-[220px] lg:h-full lg:min-h-0 lg:overflow-hidden">
          <LevelChart
            filters={filters}
            activeLevel={filters.level}
            hasLevelFilter={hasLevelFilter}
            onSelectLevel={handleSelectLevel}
          />
        </div>
        <div className="min-h-[220px] lg:h-full lg:min-h-0 lg:overflow-hidden">
          <CompletenessChart
            filters={filters}
            activeBucket={filters.completeness}
            onSelectBucket={handleSelectCompleteness}
          />
        </div>
        <div className="min-h-[220px] lg:h-full lg:min-h-0 lg:overflow-hidden">
          <TopLevelsChart
            filters={filters}
            activeLevel={filters.level}
            hasLevelFilter={hasLevelFilter}
            onSelectLevel={handleSelectLevel}
          />
        </div>
      </div>
    </div>
  );
}

type ViewerPanelProps = {
  /** Speckle ``applicationId`` values (what the viewer selects). */
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
};

function ViewerPanel({ selectedIds, onSelectedIdsChange }: ViewerPanelProps) {
  const {
    data: viewerConfig,
    isLoading: configLoading,
    isError: configError,
    error: configErr,
    refetch: refetchConfig,
  } = useViewerConfig();

  const handleViewerClick = (applicationId: string) => {
    onSelectedIdsChange(applicationId ? [applicationId] : []);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
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
  );
}

export function DashboardPage() {
  const [activeTabId, setActiveTabId] = useState("overview");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [overviewFilters, setOverviewFilters] = useState<OverviewCrossFilter>(
    {},
  );
  const { data: elementMap } = useElementMap();

  const selectedId = selectedIds[0] ?? null;
  // Map Speckle applicationId → DB element_id for row highlight.
  const selectedDbId =
    (elementMap
      ? Object.entries(elementMap).find(([, appId]) => appId === selectedId)?.[0]
      : undefined) ?? selectedId;

  /** Chat returns DB ``element_id``; viewer expects Speckle ``applicationId``. */
  const handleSelectFromChat = (elementIds: string[]) => {
    const appIds = elementIds.map((id) => elementMap?.[id] ?? id);
    setSelectedIds(appIds);
    setActiveTabId("viewer");
  };

  const showClearFilters =
    activeTabId === "overview" && hasActiveOverviewFilter(overviewFilters);

  const tabs: DashboardTab[] = [
    {
      id: "overview",
      label: "Resumen",
      panel: (
        <OverviewPanel
          filters={overviewFilters}
          onFiltersChange={setOverviewFilters}
        />
      ),
    },
    {
      id: "elements",
      label: "Elementos",
      panel: (
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <ElementTable selectedElementId={selectedDbId} />
        </div>
      ),
    },
    {
      id: "viewer",
      label: "Visor 3D",
      shortLabel: "3D",
      panel: (
        <ViewerPanel
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
        />
      ),
    },
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3">
      <Tabs
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
        className="min-h-0 flex-1"
        panelClassName="pt-3"
        preloadTabIds={["viewer"]}
        trailing={
          showClearFilters ? (
            <button
              type="button"
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              onClick={() => setOverviewFilters({})}
            >
              Limpiar filtros
            </button>
          ) : null
        }
      />
      <ChatFloatingWidget onSelectElements={handleSelectFromChat} />
    </div>
  );
}
