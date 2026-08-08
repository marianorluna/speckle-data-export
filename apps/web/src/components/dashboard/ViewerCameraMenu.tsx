import { useEffect, useId, useRef, useState } from "react";
import { Check, Expand, Info, Shrink, Video } from "lucide-react";

import type { CameraUiState, CanonicalCameraView } from "../../lib/speckle";

const VIEW_OPTIONS: { id: CanonicalCameraView; label: string; shortcut: string }[] = [
  { id: "top", label: "Top", shortcut: "Alt 1" },
  { id: "front", label: "Front", shortcut: "Alt 2" },
  { id: "left", label: "Left", shortcut: "Alt 3" },
  { id: "back", label: "Back", shortcut: "Alt 4" },
  { id: "right", label: "Right", shortcut: "Alt 5" },
];

type ViewerCameraMenuProps = {
  camera: CameraUiState;
  fullscreen: boolean;
  disabled?: boolean;
  infoOpen?: boolean;
  infoDisabled?: boolean;
  /** Soft highlight when there is a selection (even if panel closed). */
  hasSelection?: boolean;
  onToggleInfo?: () => void;
  onSetView: (view: CanonicalCameraView) => void;
  onToggleOrthographic: () => void;
  onToggleFreeOrbit: () => void;
  onToggleFullscreen: () => void;
};

export function ViewerCameraMenu({
  camera,
  fullscreen,
  disabled = false,
  infoOpen = false,
  infoDisabled = false,
  hasSelection = false,
  onToggleInfo,
  onSetView,
  onToggleOrthographic,
  onToggleFreeOrbit,
  onToggleFullscreen,
}: ViewerCameraMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="absolute top-3 right-3 z-10 flex items-start gap-1"
    >
      <div className="relative">
        <button
          type="button"
          title="Cámara y vistas"
          aria-label="Cámara y vistas"
          aria-expanded={open}
          aria-controls={menuId}
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
          className={`rounded-lg border border-gray-200 bg-white/95 p-2 text-gray-700 shadow-md backdrop-blur-sm transition-colors hover:bg-gray-50 disabled:opacity-40 ${
            open ? "ring-2 ring-sky-300" : ""
          }`}
        >
          <Video className="h-4 w-4" aria-hidden />
        </button>

        {open ? (
          <div
            id={menuId}
            role="menu"
            className="absolute top-full right-0 mt-1 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
          >
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-gray-800 hover:bg-gray-50"
                onClick={() => {
                  onSetView(option.id);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                  {option.shortcut}
                </kbd>
              </button>
            ))}

            <div className="my-1 border-t border-gray-100" />

            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={camera.orthographic}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50 ${
                camera.orthographic ? "bg-gray-50" : ""
              }`}
              onClick={() => onToggleOrthographic()}
            >
              <span>Orthographic projection</span>
              <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                Shift P
              </kbd>
            </button>

            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={camera.freeOrbit}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-gray-50"
              onClick={() => onToggleFreeOrbit()}
            >
              <span>Free orbit</span>
              {camera.freeOrbit ? (
                <Check className="h-4 w-4 text-gray-700" aria-hidden />
              ) : (
                <span className="h-4 w-4" />
              )}
            </button>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        disabled={disabled}
        onClick={onToggleFullscreen}
        className="rounded-lg border border-gray-200 bg-white/95 p-2 text-gray-700 shadow-md backdrop-blur-sm transition-colors hover:bg-gray-50 disabled:opacity-40"
      >
        {fullscreen ? (
          <Shrink className="h-4 w-4" aria-hidden />
        ) : (
          <Expand className="h-4 w-4" aria-hidden />
        )}
      </button>

      {onToggleInfo ? (
        <button
          type="button"
          title="Selection info"
          aria-label="Selection info"
          aria-pressed={infoOpen}
          disabled={disabled || infoDisabled}
          onClick={onToggleInfo}
          className={`rounded-lg border p-2 shadow-md backdrop-blur-sm transition-colors disabled:opacity-40 ${
            infoOpen
              ? "border-sky-600 bg-sky-600 text-white hover:bg-sky-700"
              : hasSelection
                ? "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
                : "border-gray-200 bg-white/95 text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Info className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
