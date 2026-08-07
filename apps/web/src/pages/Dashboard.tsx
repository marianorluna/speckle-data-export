import { Boxes, Database, Radio, ShieldAlert } from "lucide-react";

import { Card } from "../components/ui/Card";
import { ErrorMessage } from "../components/ui/ErrorMessage";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import { useElements } from "../hooks/useElements";
import { useKpis } from "../hooks/useKpis";
import { useWebSocket } from "../hooks/useWebSocket";

export function DashboardPage() {
  const { connected, lastMessage } = useWebSocket();
  const kpisQuery = useKpis();
  const elementsQuery = useElements({ limit: 5 });

  if (kpisQuery.isLoading) {
    return <LoadingSpinner label="Cargando KPIs…" />;
  }

  if (kpisQuery.isError) {
    return (
      <ErrorMessage
        message={
          kpisQuery.error instanceof Error
            ? kpisQuery.error.message
            : "No se pudieron cargar los KPIs"
        }
        onRetry={() => void kpisQuery.refetch()}
      />
    );
  }

  const kpis = kpisQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 ${
            connected
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          <Radio className="h-3.5 w-3.5" aria-hidden />
          WS {connected ? "conectado" : "desconectado"}
        </span>
        {lastMessage?.type ? (
          <span className="max-w-full truncate text-gray-400">
            Último evento: {String(lastMessage.type)}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Elementos"
          value={kpis?.total_elements ?? "—"}
          subtitle={
            elementsQuery.isSuccess
              ? `Muestra API: ${elementsQuery.data.total} total`
              : elementsQuery.isLoading
                ? "Fetch elementos…"
                : elementsQuery.isError
                  ? "Error al listar elementos"
                  : undefined
          }
          icon={<Boxes className="h-6 w-6" />}
        />
        <Card
          title="Sin fire rating"
          value={kpis?.missing_fire_rating ?? "—"}
          icon={<ShieldAlert className="h-6 w-6" />}
        />
        <Card
          title="Volumen (m³)"
          value={
            kpis
              ? kpis.total_volume_m3.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })
              : "—"
          }
          icon={<Database className="h-6 w-6" />}
        />
        <Card
          title="Área (m²)"
          value={
            kpis
              ? kpis.total_area_m2.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })
              : "—"
          }
        />
      </div>

      <p className="text-sm text-gray-500">
        Shell del dashboard lista. Gráficos y tabla completa llegan en el prompt
        09.
      </p>
    </div>
  );
}
