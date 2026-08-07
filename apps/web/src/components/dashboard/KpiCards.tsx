import { Boxes, Clock, FolderTree, ShieldAlert } from "lucide-react";

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
  return date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });
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

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        className="p-4"
        title="Total de elementos"
        value={data?.total_elements ?? "—"}
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
        title="Sin fire rating"
        value={data?.missing_fire_rating ?? "—"}
        subtitle={
          data?.missing_level
            ? `${data.missing_level} sin nivel`
            : undefined
        }
        icon={<ShieldAlert className="h-5 w-5" />}
      />
      <Card
        className="p-4"
        title="Última actualización"
        value={formatLastUpdated(data?.last_updated)}
        subtitle={
          data?.last_commit_id
            ? `Commit ${data.last_commit_id.slice(0, 8)}…`
            : undefined
        }
        icon={<Clock className="h-5 w-5" />}
      />
    </div>
  );
}
