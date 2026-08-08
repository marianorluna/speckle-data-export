import { useEffect, useState } from "react";

import type { ElementFilters } from "../../hooks/useElements";
import { useDebounce } from "../../hooks/useDebounce";
import { useCategories, useLevels } from "../../hooks/useFacets";
import { Select } from "../ui/Select";

type FilterBarProps = {
  filters: ElementFilters;
  onChange: (updater: (prev: ElementFilters) => ElementFilters) => void;
};

const selectClassName = "min-w-0 flex-1 sm:flex-none sm:min-w-[10rem]";

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

  const categoryOptions = [
    { value: "", label: "Todas las categorías" },
    ...(categoriesQuery.data ?? []).map((row) => ({
      value: row.category,
      label: `${row.category} (${row.count})`,
    })),
  ];

  const levelOptions = [
    { value: "", label: "Todos los niveles" },
    ...(levelsQuery.data ?? [])
      .filter((row): row is { level: string; count: number } =>
        Boolean(row.level),
      )
      .map((row) => ({
        value: row.level,
        label: `${row.level} (${row.count})`,
      })),
  ];

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

      <Select
        className={selectClassName}
        value={filters.category ?? ""}
        options={categoryOptions}
        onChange={(category) => {
          onChange((prev) => ({
            ...prev,
            category: category || undefined,
            skip: 0,
          }));
        }}
        aria-label="Filtrar por categoría"
      />

      <Select
        className={selectClassName}
        value={filters.level ?? ""}
        options={levelOptions}
        onChange={(level) => {
          onChange((prev) => ({
            ...prev,
            level: level || undefined,
            skip: 0,
          }));
        }}
        aria-label="Filtrar por nivel"
      />

      <Select
        className={selectClassName}
        value={filters.missing_param ?? ""}
        options={MISSING_PARAM_OPTIONS}
        onChange={(missing_param) => {
          onChange((prev) => ({
            ...prev,
            missing_param: missing_param || undefined,
            skip: 0,
          }));
        }}
        aria-label="Filtrar por parámetro faltante"
      />
    </div>
  );
}
