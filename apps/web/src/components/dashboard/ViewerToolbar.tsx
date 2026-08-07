import type { ReactNode } from "react";
import { BoxSelect, Maximize2, Ruler } from "lucide-react";

import type { ViewerToolMode } from "../../lib/speckle";

type ViewerToolbarProps = {
  mode: ViewerToolMode;
  disabled?: boolean;
  onZoomExtents: () => void;
  onToggleMeasure: () => void;
  onToggleSection: () => void;
};

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-gray-900 text-white"
          : "text-gray-700 hover:bg-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

export function ViewerToolbar({
  mode,
  disabled = false,
  onZoomExtents,
  onToggleMeasure,
  onToggleSection,
}: ViewerToolbarProps) {
  return (
    <div
      className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-gray-200 bg-white/95 p-1 shadow-md backdrop-blur-sm"
      role="toolbar"
      aria-label="Herramientas del visor 3D"
    >
      <ToolButton
        label="Ajustar a la vista"
        disabled={disabled}
        onClick={onZoomExtents}
      >
        <Maximize2 className="h-4 w-4" aria-hidden />
      </ToolButton>
      <ToolButton
        label="Medir"
        active={mode === "measure"}
        disabled={disabled}
        onClick={onToggleMeasure}
      >
        <Ruler className="h-4 w-4" aria-hidden />
      </ToolButton>
      <ToolButton
        label="Sección"
        active={mode === "section"}
        disabled={disabled}
        onClick={onToggleSection}
      >
        <BoxSelect className="h-4 w-4" aria-hidden />
      </ToolButton>
    </div>
  );
}
