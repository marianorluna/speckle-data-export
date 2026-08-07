import { Boxes, Building2, Clock, FolderTree } from "lucide-react";

import { Card } from "../ui/Card";
import { ErrorMessage } from "../ui/ErrorMessage";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { useKpis } from "../../hooks/useKpis";

function formatLastUpdated(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy}, ${hh}:${min}`;
}

export function KpiCards() {
  const { data, isLoading, isError, error, refetch } = useKpis();

  if (isLoading) {
    return <LoadingSpinner label="Cargando KPIs…" />;
  }

  if (isError) {
    return (
      <ErrorMessage
        message={
          error instanceof Error ? error.message : "No se pudieron cargar los KPIs"
        }
        onRetry={() => void refetch()}
      />
    );
  }

  const categoryCount = data
    ? Object.keys(data.elements_by_category).length
    : 0;

  const missingFire = data?.missing_fire_rating ?? 0;
  const missingLevel = data?.missing_level ?? 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        className="p-4"
        title="Proyecto"
        value={data?.model_name ?? "—"}
        subtitle={
          data?.last_commit_id
            ? `Commit ${data.last_commit_id.slice(0, 8)}…`
            : undefined
        }
        icon={<Building2 className="h-5 w-5" />}
      />
      <Card
        className="p-4"
        title="Total de elementos"
        value={data?.total_elements ?? "—"}
        subtitle={`${missingFire} sin fire rating · ${missingLevel} sin nivel`}
        icon={<Boxes className="h-5 w-5" />}
      />
      <Card
        className="p-4"
        title="Categorías"
        value={categoryCount}
        subtitle="únicas en el modelo"
        icon={<FolderTree className="h-5 w-5" />}
      />
      <Card
        className="p-4"
        title="Última actualización"
        value={formatLastUpdated(data?.last_updated)}
        icon={<Clock className="h-5 w-5" />}
      />
    </div>
  );
}
