import { useEffect, useState } from "react";

import type { ElementFilters } from "../../hooks/useElements";
import { useDebounce } from "../../hooks/useDebounce";
import { useCategories, useLevels } from "../../hooks/useFacets";

type FilterBarProps = {
  filters: ElementFilters;
  onChange: (updater: (prev: ElementFilters) => ElementFilters) => void;
};

const selectClassName =
  "min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 sm:flex-none sm:min-w-[10rem]";

/**
 * Missing-param options map to API `missing_param` (JSON keys only).
 * "Sin nivel" is not offered: `level` is a column, not a parameter key.
 */
const MISSING_PARAM_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "fire_rating", label: "Sin Fire Rating" },
];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? "");
  const debouncedSearch = useDebounce(searchInput, 300);
  const categoriesQuery = useCategories();
  const levelsQuery = useLevels();

  useEffect(() => {
    const nextSearch = debouncedSearch.trim() || undefined;
    onChange((prev) => {
      if (nextSearch === (prev.search || undefined)) {
        return prev;
      }
      return { ...prev, search: nextSearch, skip: 0 };
    });
  }, [debouncedSearch, onChange]);

  return (
    <div className="flex flex-wrap gap-3">
      <input
        type="search"
        placeholder="Buscar elemento…"
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm sm:min-w-[12rem]"
        aria-label="Buscar elementos"
      />

      <select
        className={selectClassName}
        value={filters.category ?? ""}
        onChange={(event) => {
          const category = event.target.value || undefined;
          onChange((prev) => ({ ...prev, category, skip: 0 }));
        }}
        aria-label="Filtrar por categoría"
      >
        <option value="">Todas las categorías</option>
        {(categoriesQuery.data ?? []).map((row) => (
          <option key={row.category} value={row.category}>
            {row.category} ({row.count})
          </option>
        ))}
      </select>

      <select
        className={selectClassName}
        value={filters.level ?? ""}
        onChange={(event) => {
          const level = event.target.value || undefined;
          onChange((prev) => ({ ...prev, level, skip: 0 }));
        }}
        aria-label="Filtrar por nivel"
      >
        <option value="">Todos los niveles</option>
        {(levelsQuery.data ?? [])
          .filter((row): row is { level: string; count: number } =>
            Boolean(row.level),
          )
          .map((row) => (
            <option key={row.level} value={row.level}>
              {row.level} ({row.count})
            </option>
          ))}
      </select>

      <select
        className={selectClassName}
        value={filters.missing_param ?? ""}
        onChange={(event) => {
          const missing_param = event.target.value || undefined;
          onChange((prev) => ({ ...prev, missing_param, skip: 0 }));
        }}
        aria-label="Filtrar por parámetro faltante"
      >
        {MISSING_PARAM_OPTIONS.map((opt) => (
          <option key={opt.label} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
