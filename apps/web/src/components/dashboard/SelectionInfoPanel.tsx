import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";

/** Speckle internal / geometry keys that clutter the Selection info panel. */
const SKIP_KEYS = new Set([
  "displayValue",
  "displayMesh",
  "displayValueIds",
  "__closure",
  "totalChildrenCount",
  "renderMaterialProxies",
  "colorProxies",
  "instanceDefinitionProxies",
  "instanceProxies",
  "bbox",
]);

type SelectionInfoPanelProps = {
  open: boolean;
  onClose: () => void;
  /** Speckle raw object(s) for the current React selection. */
  objects: Record<string, unknown>[];
  /** Forces remount when selection changes so nested expand state resets. */
  selectionKey: string;
};

function formatPrimitive(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    // Integers stay compact; floats → 2 decimals.
    if (Number.isInteger(value)) {
      return String(value);
    }
    return value.toFixed(2);
  }
  if (typeof value === "string") {
    if (value === "") {
      return '""';
    }
    const asNumber = Number(value);
    if (
      value.trim() !== "" &&
      Number.isFinite(asNumber) &&
      /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value.trim())
    ) {
      if (Number.isInteger(asNumber)) {
        return String(asNumber);
      }
      return asNumber.toFixed(2);
    }
    return value;
  }
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Speckle often nests Revit params as ``{ name, value, units, ... }``.
 * Prefer showing the usable ``value`` inline when present.
 */
function unwrapParamValue(value: unknown): unknown {
  if (!isPlainObject(value)) {
    return value;
  }
  if ("value" in value && Object.keys(value).length <= 6) {
    const nested = value.value;
    if (
      nested === null ||
      typeof nested === "string" ||
      typeof nested === "number" ||
      typeof nested === "boolean"
    ) {
      return nested;
    }
  }
  return value;
}

function PropertyNode({
  name,
  value,
  depth = 0,
}: {
  name: string;
  value: unknown;
  depth?: number;
}) {
  // Collapsed by default — user expands what they need.
  const [expanded, setExpanded] = useState(false);

  if (SKIP_KEYS.has(name)) {
    return null;
  }

  const displayValue = unwrapParamValue(value);

  if (Array.isArray(displayValue)) {
    if (displayValue.length === 0) {
      return (
        <div className="flex gap-2 py-0.5 text-xs" style={{ paddingLeft: depth * 12 }}>
          <span className="shrink-0 font-medium text-gray-500">{name}</span>
          <span className="text-gray-400">[]</span>
        </div>
      );
    }
    const preview = displayValue.slice(0, 20);
    return (
      <div style={{ paddingLeft: depth * 12 }}>
        <button
          type="button"
          className="flex w-full items-center gap-1 py-0.5 text-left text-xs hover:bg-gray-50"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
          )}
          <span className="font-medium text-gray-500">{name}</span>
          <span className="text-gray-400">({displayValue.length})</span>
        </button>
        {expanded
          ? preview.map((item, index) => (
              <PropertyNode
                key={`${name}-${index}`}
                name={String(index)}
                value={item}
                depth={depth + 1}
              />
            ))
          : null}
        {expanded && displayValue.length > preview.length ? (
          <div
            className="py-0.5 text-[10px] text-gray-400"
            style={{ paddingLeft: (depth + 1) * 12 + 16 }}
          >
            … +{displayValue.length - preview.length} más
          </div>
        ) : null}
      </div>
    );
  }

  if (isPlainObject(displayValue)) {
    const entries = Object.entries(displayValue).filter(
      ([key]) => !SKIP_KEYS.has(key),
    );
    return (
      <div style={{ paddingLeft: depth * 12 }}>
        <button
          type="button"
          className="flex w-full items-center gap-1 py-0.5 text-left text-xs hover:bg-gray-50"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" aria-hidden />
          )}
          <span className="font-medium text-gray-700">{name}</span>
          <span className="text-gray-400">({entries.length})</span>
        </button>
        {expanded
          ? entries.map(([key, child]) => (
              <PropertyNode key={key} name={key} value={child} depth={depth + 1} />
            ))
          : null}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-2 py-0.5 text-xs leading-snug"
      style={{ paddingLeft: depth * 12 }}
    >
      <span className="min-w-0 truncate font-medium text-gray-500" title={name}>
        {name}
      </span>
      <span className="min-w-0 break-words text-right text-gray-900" title={formatPrimitive(displayValue)}>
        {formatPrimitive(displayValue)}
      </span>
    </div>
  );
}

function ObjectSection({
  title,
  data,
}: {
  title: string;
  data: Record<string, unknown>;
}): ReactNode {
  const [open, setOpen] = useState(true);
  const entries = Object.entries(data).filter(([key]) => !SKIP_KEYS.has(key));

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        className="flex w-full items-center gap-1 px-3 py-2 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
        )}
        {title}
      </button>
      {open ? (
        <div className="space-y-0.5 px-3 pb-3">
          {entries.map(([key, value]) => (
            <PropertyNode key={key} name={key} value={value} depth={0} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SelectionInfoPanel({
  open,
  onClose,
  objects,
  selectionKey,
}: SelectionInfoPanelProps) {
  if (!open) {
    return null;
  }

  return (
    <aside
      className="absolute inset-y-0 right-0 z-20 flex w-[min(20rem,85%)] flex-col border-l border-gray-200 bg-white shadow-xl"
      aria-label="Selection info"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
        <h3 className="text-sm font-semibold text-gray-900">Selection info</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          aria-label="Cerrar información"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" key={selectionKey}>
        {objects.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-500">
            Selecciona un elemento en el modelo o en la tabla para ver sus
            propiedades.
          </p>
        ) : (
          objects.map((obj, index) => {
            const name =
              (typeof obj.name === "string" && obj.name) ||
              (typeof obj.category === "string" && obj.category) ||
              `Object ${index + 1}`;
            return (
              <ObjectSection
                key={
                  typeof obj.id === "string"
                    ? obj.id
                    : typeof obj.applicationId === "string"
                      ? obj.applicationId
                      : `obj-${index}`
                }
                title={name}
                data={obj}
              />
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t border-gray-100 px-3 py-2 text-[10px] text-gray-400">
        {objects.length} elemento{objects.length === 1 ? "" : "s"}
      </div>
    </aside>
  );
}
