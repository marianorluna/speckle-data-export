import { useEffect, useRef, useState } from "react";

import {
  applySelectionByApplicationIds,
  disposeViewer,
  getCameraUiState,
  getRawObjectsByApplicationIds,
  getSelectedRawObjects,
  getToolMode,
  getViewer,
  initViewer,
  onObjectClicked,
  resizeViewer,
  setCanonicalView,
  setToolMode,
  toggleFreeOrbit,
  toggleOrthographic,
  zoomExtents,
  type CameraUiState,
  type ViewerToolMode,
} from "../../lib/speckle";
import { ErrorMessage } from "../ui/ErrorMessage";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { SelectionInfoPanel } from "./SelectionInfoPanel";
import { ViewerCameraMenu } from "./ViewerCameraMenu";
import { ViewerToolbar } from "./ViewerToolbar";

export type SpeckleViewerProps = {
  serverUrl: string;
  streamId: string;
  commitId?: string | null;
  authToken?: string;
  /** Revit UniqueIds / Speckle applicationIds. */
  selectedElementIds: string[];
  onElementClick?: (elementId: string) => void;
};

const INITIAL_CAMERA: CameraUiState = {
  orthographic: false,
  freeOrbit: true,
};

export function SpeckleViewer({
  serverUrl,
  streamId,
  commitId,
  authToken = "",
  selectedElementIds,
  onElementClick,
}: SpeckleViewerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadToken, setLoadToken] = useState(0);
  const [toolMode, setToolModeState] = useState<ViewerToolMode>("none");
  const [camera, setCamera] = useState<CameraUiState>(INITIAL_CAMERA);
  const [fullscreen, setFullscreen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  /** Local mirror for instant Selection info updates (viewer click → same tick). */
  const [infoIds, setInfoIds] = useState<string[]>(selectedElementIds);

  /** When true, skip prop→viewer sync (viewer click already applied SelectionExtension). */
  const skipViewerSyncRef = useRef(false);

  const refreshCameraUi = () => setCamera(getCameraUiState());

  // Keep local info ids in sync when selection comes from outside the viewer.
  useEffect(() => {
    setInfoIds(selectedElementIds);
  }, [selectedElementIds]);

  const infoObjects =
    status === "ready" ? resolveSelectionInfoObjects(infoIds) : [];
  const selectionKey = infoIds.join("|") || "none";

  // Prefer SelectionExtension payload when it matches (freshest after viewer click).
  function resolveSelectionInfoObjects(
    ids: string[],
  ): Record<string, unknown>[] {
    if (ids.length === 0) {
      return [];
    }
    const fromSelection = getSelectedRawObjects();
    const selectedAppIds = fromSelection
      .map((obj) =>
        typeof obj.applicationId === "string" ? obj.applicationId.trim() : null,
      )
      .filter((id): id is string => Boolean(id));
    if (
      fromSelection.length > 0 &&
      ids.length === selectedAppIds.length &&
      ids.every((id) => selectedAppIds.includes(id))
    ) {
      return fromSelection;
    }
    return getRawObjectsByApplicationIds(ids);
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setErrorMessage(null);
    setToolModeState("none");
    setCamera(INITIAL_CAMERA);

    void (async () => {
      try {
        await initViewer({
          container,
          serverUrl,
          streamId,
          commitId,
          authToken,
        });
        if (!cancelled) {
          setStatus("ready");
          resizeViewer();
          refreshCameraUi();
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(
            error instanceof Error ? error.message : "No se pudo cargar el visor 3D",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      disposeViewer();
    };
  }, [serverUrl, streamId, commitId, authToken, loadToken]);

  // Keep WebGL viewport correct when the tab/panel is shown again after `hidden`.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || status !== "ready") {
      return;
    }
    const observer = new ResizeObserver(() => {
      resizeViewer();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [status]);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }
    // HMR can wipe the module singleton while React still thinks we are ready.
    if (!getViewer()) {
      setLoadToken((n) => n + 1);
      return;
    }
    if (skipViewerSyncRef.current) {
      skipViewerSyncRef.current = false;
      return;
    }
    applySelectionByApplicationIds(selectedElementIds, {
      zoom: selectedElementIds.length > 0,
    });
  }, [selectedElementIds, status]);

  useEffect(() => {
    if (status !== "ready" || !onElementClick) {
      return;
    }
    return onObjectClicked((applicationId) => {
      skipViewerSyncRef.current = true;
      // Drop previous tint/selection; keep a single pick without reframing.
      applySelectionByApplicationIds(applicationId ? [applicationId] : [], {
        zoom: false,
      });
      setInfoIds(applicationId ? [applicationId] : []);
      onElementClick(applicationId ?? "");
    });
  }, [onElementClick, status]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const root = rootRef.current;
      setFullscreen(Boolean(root && document.fullscreenElement === root));
      resizeViewer();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const viewByDigit: Record<string, Parameters<typeof setCanonicalView>[0]> = {
          "1": "top",
          "2": "front",
          "3": "left",
          "4": "back",
          "5": "right",
        };
        const view = viewByDigit[event.key];
        if (view) {
          event.preventDefault();
          setCanonicalView(view);
          return;
        }
      }

      if (event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
        if (event.key === "P" || event.key === "p") {
          event.preventDefault();
          toggleOrthographic();
          refreshCameraUi();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status]);

  const syncToolMode = (mode: ViewerToolMode) => {
    setToolMode(mode);
    setToolModeState(getToolMode());
  };

  const toggleFullscreen = async () => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    try {
      if (document.fullscreenElement === root) {
        await document.exitFullscreen();
      } else {
        await root.requestFullscreen();
      }
    } catch {
      // Browser may deny fullscreen without a user gesture / policy.
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
    >
      <div ref={containerRef} className="min-h-0 flex-1" />

      {status === "ready" ? (
        <>
          <ViewerCameraMenu
            camera={camera}
            fullscreen={fullscreen}
            infoOpen={infoOpen}
            hasSelection={selectedElementIds.length > 0}
            onToggleInfo={() => setInfoOpen((open) => !open)}
            onSetView={(view) => setCanonicalView(view)}
            onToggleOrthographic={() => {
              toggleOrthographic();
              refreshCameraUi();
            }}
            onToggleFreeOrbit={() => {
              toggleFreeOrbit();
              refreshCameraUi();
            }}
            onToggleFullscreen={() => {
              void toggleFullscreen();
            }}
          />
          <SelectionInfoPanel
            open={infoOpen}
            onClose={() => setInfoOpen(false)}
            objects={infoObjects}
            selectionKey={selectionKey}
          />
          <ViewerToolbar
            mode={toolMode}
            onZoomExtents={() => zoomExtents()}
            onToggleMeasure={() =>
              syncToolMode(toolMode === "measure" ? "none" : "measure")
            }
            onToggleSection={() =>
              syncToolMode(toolMode === "section" ? "none" : "section")
            }
          />
        </>
      ) : null}

      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
          <LoadingSpinner label="Cargando modelo 3D…" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 p-4">
          <ErrorMessage
            message={errorMessage ?? "Error al cargar el visor"}
            onRetry={() => setLoadToken((n) => n + 1)}
          />
        </div>
      ) : null}
    </div>
  );
}

export default SpeckleViewer;
