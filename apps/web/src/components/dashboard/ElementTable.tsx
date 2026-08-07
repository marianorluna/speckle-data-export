import { useState } from "react";

import {
  useElements,
  type BimElement,
  type ElementFilters,
} from "../../hooks/useElements";
import { Card } from "../ui/Card";
import { ErrorMessage } from "../ui/ErrorMessage";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { chartColorAt } from "./chartPalette";
import { FilterBar } from "./FilterBar";

const DEFAULT_LIMIT = 25;

const CRITICAL_PARAM_KEYS = [
  "fire_rating",
  "Fire Rating",
  "width",
  "Width",
  "height",
  "Height",
] as const;

function truncateId(id: string, max = 12): string {
  if (id.length <= max) {
    return id;
  }
  return `${id.slice(0, max)}…`;
}

function categoryColor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i += 1) {
    hash = (hash + category.charCodeAt(i) * (i + 1)) % 997;
  }
  return chartColorAt(hash % 8);
}

function formatParamValue(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed !== "" && Number.isFinite(Number(trimmed))) {
      return Number(trimmed).toFixed(2);
    }
  }
  return String(value);
}

function formatCriticalParams(parameters: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of CRITICAL_PARAM_KEYS) {
    const value = parameters[key];
    if (value === undefined || value === null || value === "") {
      continue;
    }
    parts.push(`${key}: ${formatParamValue(value)}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function Badge({
  label,
  color,
}: {
  label: string;
  color?: string;
}) {
  return (
    <span
      className="inline-flex max-w-full truncate rounded-md px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: color ?? "#6b7280" }}
      title={label}
    >
      {label}
    </span>
  );
}

function Pagination({
  total,
  skip,
  limit,
  onPageChange,
}: {
  total: number;
  skip: number;
  limit: number;
  onPageChange: (nextSkip: number) => void;
}) {
  const page = Math.floor(skip / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const canPrev = skip > 0;
  const canNext = skip + limit < total;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
      <span>
        {total === 0
          ? "0 elementos"
          : `${skip + 1}–${Math.min(skip + limit, total)} de ${total}`}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(Math.max(0, skip - limit))}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        <span className="tabular-nums">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(skip + limit)}
          className="rounded-md border border-gray-300 bg-white px-2.5 py-1 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

function ElementsTableBody({
  rows,
  selectedElementId,
  onRowClick,
}: {
  rows: BimElement[];
  selectedElementId?: string | null;
  onRowClick?: (elementId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        No hay elementos con estos filtros.
      </p>
    );
  }

  return (
    <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
      <thead className="sticky top-0 z-10 bg-white">
        <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 shadow-[0_1px_0_0_#e5e7eb]">
          <th className="bg-white px-2 py-2 font-medium">ID</th>
          <th className="bg-white px-2 py-2 font-medium">Categoría</th>
          <th className="bg-white px-2 py-2 font-medium">Familia / Tipo</th>
          <th className="bg-white px-2 py-2 font-medium">Nivel</th>
          <th className="bg-white px-2 py-2 font-medium">Parámetros</th>
          <th className="bg-white px-2 py-2 font-medium">Acción</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const selected = row.element_id === selectedElementId;
          return (
            <tr
              key={row.id}
              className={`border-b border-gray-100 ${
                selected ? "bg-sky-50" : "hover:bg-gray-50"
              }`}
            >
              <td
                className="px-2 py-2 font-mono text-xs text-gray-700"
                title={row.element_id}
              >
                {truncateId(row.element_id)}
              </td>
              <td className="px-2 py-2">
                <Badge
                  label={row.category}
                  color={categoryColor(row.category)}
                />
              </td>
              <td className="max-w-[14rem] px-2 py-2 text-gray-800">
                <span className="line-clamp-2">
                  {[row.family, row.type_name].filter(Boolean).join(" / ") ||
                    "—"}
                </span>
              </td>
              <td className="px-2 py-2">
                {row.level ? (
                  <Badge label={row.level} color="#64748b" />
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td
                className="max-w-[16rem] truncate px-2 py-2 text-xs text-gray-600"
                title={formatCriticalParams(row.parameters)}
              >
                {formatCriticalParams(row.parameters)}
              </td>
              <td className="px-2 py-2">
                <button
                  type="button"
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!onRowClick}
                  onClick={() => onRowClick?.(row.element_id)}
                >
                  Seleccionar
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export type ElementTableProps = {
  selectedElementId?: string | null;
  onRowClick?: (elementId: string) => void;
};

export function ElementTable({
  selectedElementId,
  onRowClick,
}: ElementTableProps) {
  const [filters, setFilters] = useState<ElementFilters>({
    skip: 0,
    limit: DEFAULT_LIMIT,
  });
  const { data, isLoading, isError, error, refetch, isFetching } =
    useElements(filters);

  const skip = filters.skip ?? 0;
  const limit = filters.limit ?? DEFAULT_LIMIT;

  return (
    <Card
      title="Elementos"
      className="flex h-full min-h-0 flex-col overflow-hidden p-4 sm:p-6"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="shrink-0">
          <FilterBar filters={filters} onChange={setFilters} />
        </div>

        {isLoading ? (
          <LoadingSpinner label="Cargando elementos…" />
        ) : isError ? (
          <ErrorMessage
            message={
              error instanceof Error
                ? error.message
                : "No se pudieron cargar los elementos"
            }
            onRetry={() => void refetch()}
          />
        ) : (
          <>
            <div
              className={`min-h-0 flex-1 overflow-auto ${
                isFetching ? "opacity-70 transition-opacity" : ""
              }`}
            >
              <ElementsTableBody
                rows={data?.data ?? []}
                selectedElementId={selectedElementId}
                onRowClick={onRowClick}
              />
            </div>
            <div className="shrink-0 border-t border-gray-100 pt-3">
              <Pagination
                total={data?.total ?? 0}
                skip={skip}
                limit={limit}
                onPageChange={(nextSkip) =>
                  setFilters((current) => ({ ...current, skip: nextSkip }))
                }
              />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
